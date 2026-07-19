"use client";

import Link from "next/link";
import { Badge, Button, Card } from "@backuphub/ui";
import { formatBytes, formatRelativeTime } from "@backuphub/shared";
import { RequireAuth } from "@/components/require-auth";
import { Navbar } from "@/components/dashboard/navbar";
import {
  useBackupPlans,
  useSetBackupPlanStatus,
  useDeleteBackupPlan,
} from "@/hooks/use-backup-plans";
import { usePlanExecutions, useRunBackupPlan, useCancelExecution } from "@/hooks/use-executions";
import type { BackupPlan, ExecutionStatus } from "@backuphub/types";

const EXECUTION_TONE: Record<ExecutionStatus, "success" | "danger" | "info" | "neutral"> = {
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  RUNNING: "info",
  PENDING: "neutral",
};

export default function PlanesPage() {
  return (
    <RequireAuth>
      <Navbar />
      <PlanesContent />
    </RequireAuth>
  );
}

function PlanCard({ plan }: { plan: BackupPlan }) {
  const setStatus = useSetBackupPlanStatus();
  const remove = useDeleteBackupPlan();
  const { data: executions } = usePlanExecutions(plan.id);
  const runPlan = useRunBackupPlan(plan.id);
  const cancelExecution = useCancelExecution(plan.id);

  const latest = executions?.[0];
  const isRunning = latest?.status === "RUNNING" || latest?.status === "PENDING";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">
            {plan.agent?.name ?? "Equipo desconocido"}
          </p>
        </div>
        <Badge tone={plan.status === "active" ? "success" : "neutral"}>
          {plan.status === "active" ? "Activo" : "Pausado"}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        {plan.sources.length} carpeta(s) · destino: {plan.destinations[0]?.type ?? "—"}
      </p>

      {latest && (
        <div className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
          <div>
            <Badge tone={EXECUTION_TONE[latest.status]}>{latest.status}</Badge>{" "}
            <span className="text-muted-foreground">
              {latest.startedAt ? formatRelativeTime(latest.startedAt) : ""}
            </span>
          </div>
          <span className="text-muted-foreground">
            {latest.filesTotal != null ? `${latest.filesTotal} archivo(s)` : ""}
            {latest.bytesTotal != null ? ` · ${formatBytes(latest.bytesTotal)}` : ""}
          </span>
        </div>
      )}
      {latest?.errorMessage && <p className="text-xs text-danger">{latest.errorMessage}</p>}

      <div className="flex flex-wrap gap-1.5">
        {plan.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        {isRunning ? (
          <Button
            size="sm"
            variant="danger"
            disabled={cancelExecution.isPending}
            onClick={() => latest && cancelExecution.mutate(latest.id)}
          >
            Cancelar
          </Button>
        ) : (
          <Button size="sm" disabled={runPlan.isPending} onClick={() => runPlan.mutate()}>
            {runPlan.isPending ? "Iniciando..." : "Ejecutar ahora"}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={setStatus.isPending}
          onClick={() =>
            setStatus.mutate({
              id: plan.id,
              action: plan.status === "active" ? "pause" : "resume",
            })
          }
        >
          {plan.status === "active" ? "Pausar" : "Reanudar"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`¿Eliminar el plan "${plan.name}"?`)) {
              remove.mutate(plan.id);
            }
          }}
        >
          Eliminar
        </Button>
      </div>
    </Card>
  );
}

function PlanesContent() {
  const { data: plans, isLoading, isError } = useBackupPlans();

  return (
    <main className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planes de backup</h1>
          <p className="text-sm text-muted-foreground">
            Qué se respalda, a dónde, y con qué configuración.
          </p>
        </div>
        <Link href="/planes/nuevo">
          <Button>Crear plan</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando planes...</p>}
      {isError && (
        <p className="text-sm text-danger">No se pudieron cargar los planes de backup.</p>
      )}

      {plans && plans.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Todavía no has creado ningún plan. Pulsa "Crear plan" para empezar
          el wizard de 4 pasos.
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </main>
  );
}
