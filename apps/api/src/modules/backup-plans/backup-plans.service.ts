import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBackupPlanDto } from "./dto/create-backup-plan.dto";
import { UpdateBackupPlanDto } from "./dto/update-backup-plan.dto";

const DEFAULT_EXCLUDE_FILTERS = ["node_modules", ".git", "temp", "cache"];
const DEFAULT_VERSIONING_MAX = 10;

@Injectable()
export class BackupPlansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.backupPlan.findMany({
      include: { sources: true, destinations: true, agent: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.backupPlan.findUnique({
      where: { id },
      include: {
        sources: true,
        destinations: true,
        agent: true,
        executions: { orderBy: { startedAt: "desc" }, take: 10 },
      },
    });
    if (!plan) throw new NotFoundException("Plan de backup no encontrado");
    return plan;
  }

  create(dto: CreateBackupPlanDto, ownerId: string) {
    return this.prisma.backupPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        schedule: dto.schedule,
        versioningMax: dto.versioningMax ?? DEFAULT_VERSIONING_MAX,
        compression: dto.compression ?? false,
        encryption: dto.encryption ?? true,
        excludeFilters: dto.excludeFilters ?? DEFAULT_EXCLUDE_FILTERS,
        tags: dto.tags ?? [],
        status: "active",
        owner: { connect: { id: ownerId } },
        agent: { connect: { id: dto.agentId } },
        sources: {
          create: dto.sourcePaths.map((path) => ({
            path,
            agent: { connect: { id: dto.agentId } },
          })),
        },
        destinations: {
          create: [{ type: dto.destination.type, path: dto.destination.path }],
        },
      },
      include: { sources: true, destinations: true },
    });
  }

  async update(id: string, dto: UpdateBackupPlanDto) {
    await this.findOne(id);
    // Los cambios de origen/destino se reemplazan por completo (no
    // hace merge parcial de arrays) para no dejar estados intermedios
    // inconsistentes; si el wizard de edición solo cambia settings de
    // config, sourcePaths/destination simplemente no se envían.
    return this.prisma.backupPlan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        schedule: dto.schedule,
        versioningMax: dto.versioningMax,
        compression: dto.compression,
        encryption: dto.encryption,
        excludeFilters: dto.excludeFilters,
        tags: dto.tags,
        ...(dto.sourcePaths && dto.agentId
          ? {
              sources: {
                deleteMany: {},
                create: dto.sourcePaths.map((path) => ({
                  path,
                  agent: { connect: { id: dto.agentId as string } },
                })),
              },
            }
          : {}),
        ...(dto.destination
          ? {
              destinations: {
                deleteMany: {},
                create: [{ type: dto.destination.type, path: dto.destination.path }],
              },
            }
          : {}),
      },
      include: { sources: true, destinations: true },
    });
  }

  async setStatus(id: string, status: "active" | "paused") {
    await this.findOne(id);
    return this.prisma.backupPlan.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.backupPlan.delete({ where: { id } });
    return { success: true };
  }
}
