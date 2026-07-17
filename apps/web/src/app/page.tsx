"use client";

import { Server, ShieldCheck, HardDrive, AlertTriangle, Clock } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Navbar } from "@/components/dashboard/navbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { SpaceChart } from "@/components/dashboard/space-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { UpcomingPanel } from "@/components/dashboard/upcoming-panel";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { formatBytes, formatRelativeTime } from "@backuphub/shared";

export default function HomePage() {
  return (
    <RequireAuth>
      <Navbar />
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { data, isLoading, isError } = useDashboardSummary();

  if (isLoading) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="p-8">
        <p className="text-sm text-danger">
          No se pudo cargar el dashboard. Comprueba que la API esté
          levantada y accesible.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Estado general de tus equipos y backups.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Equipos conectados"
          value={`${data.agentsOnline} / ${data.agentsTotal}`}
          icon={Server}
          hint="Agentes en línea sobre el total"
        />
        <StatCard
          title="Backups activos"
          value={String(data.activeBackups)}
          icon={ShieldCheck}
        />
        <StatCard
          title="Último backup"
          value={
            data.lastExecutionAt ? formatRelativeTime(data.lastExecutionAt) : "—"
          }
          icon={Clock}
        />
        <StatCard
          title="Backups fallidos (24h)"
          value={String(data.failedExecutions24h)}
          icon={AlertTriangle}
          tone={data.failedExecutions24h > 0 ? "danger" : "default"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SpaceChart usedBytes={data.usedBytes} freeBytes={data.freeBytes} />
        </div>
        <div className="lg:col-span-1">
          <UpcomingPanel executions={data.upcomingExecutions} />
        </div>
        <div className="lg:col-span-1">
          <AlertsPanel alerts={data.recentAlerts} />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Espacio total gestionado: {formatBytes(data.usedBytes + data.freeBytes)}
        {" · "}
        <HardDrive className="inline h-3 w-3" /> se actualiza cada 30s
      </p>
    </main>
  );
}
