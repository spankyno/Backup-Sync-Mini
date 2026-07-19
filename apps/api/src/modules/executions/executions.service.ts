import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const AGENT_TIMEOUT_MS = 8000;

interface AgentExecutionStatus {
  id: string;
  plan_id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  started_at: string;
  finished_at: string | null;
  files_total: number;
  files_done: number;
  bytes_total: number;
  error_message: string | null;
}

interface AgentFileEntry {
  path: string;
  hash: string | null;
  size: number | null;
}

export interface ExecutionFilters {
  planId?: string;
  agentId?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class ExecutionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForPlan(planId: string) {
    return this.prisma.execution.findMany({
      where: { backupPlanId: planId },
      orderBy: { startedAt: "desc" },
    });
  }

  /** Historial completo, con filtros — usado por la pantalla /historial. */
  async findAll(filters: ExecutionFilters) {
    const where = this.buildWhere(filters);
    return this.prisma.execution.findMany({
      where,
      include: { backupPlan: { include: { agent: true } } },
      orderBy: { startedAt: "desc" },
      take: 200,
    });
  }

  async exportCsv(filters: ExecutionFilters): Promise<string> {
    const where = this.buildWhere(filters);
    const executions = await this.prisma.execution.findMany({
      where,
      include: { backupPlan: true },
      orderBy: { startedAt: "desc" },
    });

    const header = ["Plan", "Inicio", "Fin", "Duración (s)", "Estado", "Archivos", "Bytes", "Error"];
    const rows = executions.map((e) => {
      const durationSec =
        e.startedAt && e.finishedAt
          ? Math.round((e.finishedAt.getTime() - e.startedAt.getTime()) / 1000)
          : "";
      return [
        e.backupPlan.name,
        e.startedAt?.toISOString() ?? "",
        e.finishedAt?.toISOString() ?? "",
        String(durationSec),
        e.status,
        String(e.filesTotal ?? ""),
        String(e.bytesTotal ?? ""),
        (e.errorMessage ?? "").replace(/[\r\n,]+/g, " "),
      ];
    });

    return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  private buildWhere(filters: ExecutionFilters) {
    const where: Record<string, unknown> = {};
    if (filters.planId) where.backupPlanId = filters.planId;
    if (filters.status) where.status = filters.status;
    if (filters.agentId) where.backupPlan = { agentId: filters.agentId };
    if (filters.from || filters.to) {
      where.startedAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    if (filters.search) {
      where.OR = [
        { errorMessage: { contains: filters.search, mode: "insensitive" } },
        { backupPlan: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }
    return where;
  }

  async findOne(id: string) {
    const execution = await this.prisma.execution.findUnique({ where: { id } });
    if (!execution) throw new NotFoundException("Ejecución no encontrada");
    return execution;
  }

  /** Archivos (con hash) de una ejecución ya sincronizada. */
  async getFiles(id: string) {
    await this.findOne(id);
    const version = await this.prisma.version.findFirst({
      where: { executionId: id },
      include: { files: true },
    });
    return version?.files ?? [];
  }

  /** Crea la ejecución en Postgres y le pide al agente que la arranque. */
  async create(planId: string) {
    const plan = await this.prisma.backupPlan.findUnique({
      where: { id: planId },
      include: { sources: true, destinations: true, agent: true },
    });
    if (!plan) throw new NotFoundException("Plan de backup no encontrado");
    if (plan.sources.length === 0) {
      throw new BadRequestException("El plan no tiene carpetas de origen configuradas");
    }
    const destination = plan.destinations[0];
    if (!destination) {
      throw new BadRequestException("El plan no tiene un destino configurado");
    }

    const execution = await this.prisma.execution.create({
      data: { backupPlanId: planId, status: "PENDING", startedAt: new Date() },
    });

    try {
      await this.callAgent(plan.agent.apiUrl, plan.agent.authToken, "/backups", "POST", {
        execution_id: execution.id,
        plan_id: planId,
        sources: plan.sources.map((s) => s.path),
        destination_path: destination.path,
        versioning_max: plan.versioningMax,
        compression: plan.compression,
        encryption: plan.encryption,
        exclude_filters: plan.excludeFilters,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "error desconocido";
      return this.prisma.execution.update({
        where: { id: execution.id },
        data: { status: "FAILED", errorMessage: `No se pudo contactar con el agente: ${reason}`, finishedAt: new Date() },
      });
    }

    return this.prisma.execution.update({
      where: { id: execution.id },
      data: { status: "RUNNING" },
    });
  }

  /** Vuelve a preguntarle al agente por el estado real y lo refleja en Postgres. */
  async sync(id: string) {
    const execution = await this.findOne(id);
    const plan = await this.prisma.backupPlan.findUnique({
      where: { id: execution.backupPlanId },
      include: { agent: true },
    });
    if (!plan) throw new NotFoundException("Plan de backup no encontrado");

    // Si ya terminó, no hace falta volver a preguntarle al agente.
    if (execution.status === "SUCCESS" || execution.status === "FAILED" || execution.status === "CANCELLED") {
      return execution;
    }

    try {
      const remote = await this.callAgent<AgentExecutionStatus>(
        plan.agent.apiUrl,
        plan.agent.authToken,
        `/backups/${id}`,
        "GET",
      );

      const updated = await this.prisma.execution.update({
        where: { id },
        data: {
          status: remote.status,
          filesTotal: remote.files_total,
          bytesTotal: BigInt(remote.bytes_total),
          errorMessage: remote.error_message,
          finishedAt: remote.finished_at ? new Date(remote.finished_at) : null,
        },
      });

      if (remote.status === "SUCCESS") {
        await this.syncFileManifest(id, plan.agent.apiUrl, plan.agent.authToken);
      }

      return updated;
    } catch {
      // El agente puede estar desconectado momentáneamente; no lo
      // marcamos como fallido solo por no haber podido preguntar.
      return execution;
    }
  }

  /**
   * Trae el manifiesto de archivos del agente y lo guarda en Postgres
   * (Version + File) para que Historial/Inventario puedan mostrarlo
   * sin depender de que el agente esté online en ese momento.
   */
  private async syncFileManifest(executionId: string, apiUrl: string, authToken: string) {
    const alreadySynced = await this.prisma.version.findFirst({ where: { executionId } });
    if (alreadySynced) return;

    let files: AgentFileEntry[];
    try {
      files = await this.callAgent<AgentFileEntry[]>(
        apiUrl,
        authToken,
        `/backups/${executionId}/files`,
        "GET",
      );
    } catch {
      return; // se reintentará en el siguiente sync() si hace falta
    }

    const version = await this.prisma.version.create({ data: { executionId } });
    if (files.length === 0) return;

    await this.prisma.file.createMany({
      data: files.map((f) => ({
        versionId: version.id,
        path: f.path,
        sizeBytes: BigInt(f.size ?? 0),
        sha256: f.hash ?? "",
        modifiedAt: new Date(),
        status: "synced",
      })),
    });
  }

  async cancel(id: string) {
    const execution = await this.findOne(id);
    const plan = await this.prisma.backupPlan.findUnique({
      where: { id: execution.backupPlanId },
      include: { agent: true },
    });
    if (!plan) throw new NotFoundException("Plan de backup no encontrado");

    await this.callAgent(plan.agent.apiUrl, plan.agent.authToken, `/backups/${id}/cancel`, "POST");
    return this.sync(id);
  }

  async getLogs(id: string): Promise<Array<{ level: string; message: string; created_at: string }>> {
    const execution = await this.findOne(id);
    const plan = await this.prisma.backupPlan.findUnique({
      where: { id: execution.backupPlanId },
      include: { agent: true },
    });
    if (!plan) throw new NotFoundException("Plan de backup no encontrado");

    return this.callAgent(plan.agent.apiUrl, plan.agent.authToken, `/backups/${id}/logs`, "GET");
  }

  private async callAgent<T = unknown>(
    apiUrl: string,
    authToken: string,
    path: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        throw new Error(`El agente respondió con estado ${res.status}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
