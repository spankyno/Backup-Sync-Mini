import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      agentsOnline,
      agentsTotal,
      activeBackups,
      lastExecution,
      agentsSpace,
      failedExecutions24h,
      upcomingExecutions,
      recentAlerts,
    ] = await Promise.all([
      this.prisma.agent.count({ where: { status: "ONLINE" } }),
      this.prisma.agent.count(),
      this.prisma.backupPlan.count({ where: { status: "active" } }),
      this.prisma.execution.findFirst({
        where: { status: "SUCCESS" },
        orderBy: { finishedAt: "desc" },
      }),
      this.prisma.agent.findMany({
        select: { capacityBytes: true, freeBytes: true },
      }),
      this.prisma.execution.count({
        where: {
          status: "FAILED",
          startedAt: { gte: new Date(Date.now() - ONE_DAY_MS) },
        },
      }),
      this.prisma.execution.findMany({
        where: { status: "PENDING" },
        orderBy: { startedAt: "asc" },
        take: 5,
      }),
      this.prisma.alert.findMany({
        where: { resolved: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const { usedBytes, freeBytes } = agentsSpace.reduce(
      (acc, agent) => {
        const capacity = Number(agent.capacityBytes ?? 0n);
        const free = Number(agent.freeBytes ?? 0n);
        acc.freeBytes += free;
        acc.usedBytes += Math.max(capacity - free, 0);
        return acc;
      },
      { usedBytes: 0, freeBytes: 0 },
    );

    return {
      agentsOnline,
      agentsTotal,
      activeBackups,
      lastExecutionAt: lastExecution?.finishedAt?.toISOString() ?? null,
      usedBytes,
      freeBytes,
      failedExecutions24h,
      upcomingExecutions: upcomingExecutions.map((execution) => ({
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt?.toISOString() ?? null,
        finishedAt: execution.finishedAt?.toISOString() ?? null,
        filesTotal: execution.filesTotal,
        bytesTotal: execution.bytesTotal ? Number(execution.bytesTotal) : null,
        errorMessage: execution.errorMessage,
        backupPlanId: execution.backupPlanId,
      })),
      recentAlerts: recentAlerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        resolved: alert.resolved,
        createdAt: alert.createdAt.toISOString(),
      })),
    };
  }
}
