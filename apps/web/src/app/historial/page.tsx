"use client";

import { useState } from "react";
import { Badge, Button, Card, Input } from "@backuphub/ui";
import { formatBytes } from "@backuphub/shared";
import { RequireAuth } from "@/components/require-auth";
import { Navbar } from "@/components/dashboard/navbar";
import { useBackupPlans } from "@/hooks/use-backup-plans";
import {
  useExecutionHistory,
  buildExportUrl,
  type HistoryFilters,
} from "@/hooks/use-execution-history";
import { useAuthStore } from "@/stores/auth-store";
import type { ExecutionStatus } from "@backuphub/types";

const STATUS_OPTIONS: ExecutionStatus[] = ["PENDING", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"];

const TONE: Record<ExecutionStatus, "success" | "danger" | "info" | "neutral"> = {
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  RUNNING: "info",
  PENDING: "neutral",
};

export default function HistorialPage() {
  return (
    <RequireAuth>
      <Navbar />
      <HistorialContent />
    </RequireAuth>
  );
}

function HistorialContent() {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const { data: plans } = useBackupPlans();
  const { data: executions, isLoading, isError } = useExecutionHistory(filters);
  const accessToken = useAuthStore((s) => s.accessToken);

  const update = (patch: Partial<HistoryFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const handleExport = async () => {
    const res = await fetch(buildExportUrl(filters), {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historial-backups.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Historial</h1>
          <p className="text-sm text-muted-foreground">
            Inicio, fin, duración, archivos, hashes y errores de cada ejecución.
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          Exportar CSV
        </Button>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Plan</label>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={filters.planId ?? ""}
            onChange={(e) => update({ planId: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {plans?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Estado</label>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={filters.status ?? ""}
            onChange={(e) => update({ status: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            className="h-9"
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input
            type="date"
            className="h-9"
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Buscar (plan o error)</label>
          <Input
            placeholder="p.ej. timeout, Backup diario..."
            onChange={(e) => update({ search: e.target.value || undefined })}
          />
        </div>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando historial...</p>}
      {isError && <p className="text-sm text-danger">No se pudo cargar el historial.</p>}

      {executions && executions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay ejecuciones que coincidan con estos filtros.
        </div>
      )}

      {executions && executions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Plan</th>
                <th className="p-2 text-left">Inicio</th>
                <th className="p-2 text-left">Duración</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-left">Archivos</th>
                <th className="p-2 text-left">Espacio</th>
                <th className="p-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <tr key={exec.id} className="border-t border-border">
                  <td className="p-2">{exec.backupPlan?.name ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">
                    {exec.startedAt ? new Date(exec.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">{duration(exec.startedAt, exec.finishedAt)}</td>
                  <td className="p-2">
                    <Badge tone={TONE[exec.status]}>{exec.status}</Badge>
                  </td>
                  <td className="p-2">{exec.filesTotal ?? "—"}</td>
                  <td className="p-2">{exec.bytesTotal != null ? formatBytes(exec.bytesTotal) : "—"}</td>
                  <td className="max-w-[240px] truncate p-2 text-danger" title={exec.errorMessage ?? ""}>
                    {exec.errorMessage ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const seconds = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
