import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

const PING_TIMEOUT_MS = 5000;
const VALID_OS = ["WINDOWS", "LINUX", "MACOS"] as const;
type ValidOs = (typeof VALID_OS)[number];

interface AgentHealthResponse {
  status: string;
  service: string;
  version: string;
  os?: string;
}

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException("Agente no encontrado");
    return agent;
  }

  async create(dto: CreateAgentDto) {
    const health = await this.pingAgent(dto.apiUrl, dto.authToken);
    const os = this.resolveOs(health.os);
    if (!os) {
      throw new BadRequestException(
        "El agente no reportó un sistema operativo reconocible (WINDOWS/LINUX/MACOS). Actualiza el Backup Agent a la última versión.",
      );
    }

    return this.prisma.agent.create({
      data: {
        name: dto.name,
        apiUrl: dto.apiUrl,
        authToken: dto.authToken,
        os,
        version: health.version,
        status: "ONLINE",
        lastSeenAt: new Date(),
      },
    });
  }

  async update(id: string, dto: UpdateAgentDto) {
    await this.findOne(id);
    return this.prisma.agent.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agent.delete({ where: { id } });
    return { success: true };
  }

  /** Vuelve a comprobar si el agente responde y actualiza su estado. */
  async sync(id: string) {
    const agent = await this.findOne(id);

    try {
      const health = await this.pingAgent(agent.apiUrl, agent.authToken);
      return this.prisma.agent.update({
        where: { id },
        data: {
          status: "ONLINE",
          version: health.version,
          os: this.resolveOs(health.os) ?? agent.os,
          lastSeenAt: new Date(),
        },
      });
    } catch {
      return this.prisma.agent.update({
        where: { id },
        data: { status: "OFFLINE" },
      });
    }
  }

  /**
   * Placeholder: actualizar/reiniciar el agente de forma remota requiere
   * un endpoint de gestión de proceso en el propio Backup Agent (Rust)
   * que todavía no existe (llega en la Fase 6, junto al motor de backup).
   */
  restart(_id: string): never {
    throw new NotImplementedException(
      "Reiniciar el agente en remoto todavía no está implementado (llega en la Fase 6).",
    );
  }

  requestUpdate(_id: string): never {
    throw new NotImplementedException(
      "La actualización remota del agente todavía no está implementada (llega en la Fase 6).",
    );
  }

  private async pingAgent(apiUrl: string, authToken?: string): Promise<AgentHealthResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/health`, {
        signal: controller.signal,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) {
        throw new Error(`El agente respondió con estado ${res.status}`);
      }
      return (await res.json()) as AgentHealthResponse;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "error desconocido";
      throw new BadRequestException(
        `No se pudo conectar con el agente en ${apiUrl}: ${reason}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveOs(rawOs: string | undefined): ValidOs | undefined {
    if (!rawOs) return undefined;
    const upper = rawOs.toUpperCase();
    return (VALID_OS as readonly string[]).includes(upper)
      ? (upper as ValidOs)
      : undefined;
  }
}
