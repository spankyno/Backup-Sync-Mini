"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@backuphub/ui";
import { formatBytes, formatRelativeTime } from "@backuphub/shared";
import type { Agent, AgentStatus } from "@backuphub/types";
import {
  useDeleteAgent,
  useRequestAgentUpdate,
  useRestartAgent,
  useSyncAgent,
  isApiError,
} from "@/hooks/use-agents";

const statusTone: Record<AgentStatus, "success" | "danger" | "neutral"> = {
  ONLINE: "success",
  OFFLINE: "danger",
  UNKNOWN: "neutral",
};

const statusLabel: Record<AgentStatus, string> = {
  ONLINE: "En línea",
  OFFLINE: "Desconectado",
  UNKNOWN: "Desconocido",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const [notice, setNotice] = useState<string | null>(null);
  const sync = useSyncAgent();
  const restart = useRestartAgent();
  const requestUpdate = useRequestAgentUpdate();
  const remove = useDeleteAgent();

  const runAction = async (
    action: () => Promise<unknown>,
    fallbackMessage: string,
  ) => {
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice(isApiError(err) ? err.message : fallbackMessage);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${agent.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    await runAction(() => remove.mutateAsync(agent.id), "No se pudo eliminar el equipo.");
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{agent.name}</h3>
          <p className="text-xs text-muted-foreground">
            {agent.os} · v{agent.version}
          </p>
        </div>
        <Badge tone={statusTone[agent.status]}>{statusLabel[agent.status]}</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
        <dt>Última sincronización</dt>
        <dd className="text-right text-foreground">
          {agent.lastSeenAt ? formatRelativeTime(agent.lastSeenAt) : "Nunca"}
        </dd>
        <dt>Espacio libre</dt>
        <dd className="text-right text-foreground">
          {agent.freeBytes != null ? formatBytes(agent.freeBytes) : "—"}
        </dd>
      </dl>

      {notice && <p className="text-xs text-danger">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={sync.isPending}
          onClick={() => runAction(() => sync.mutateAsync(agent.id), "No se pudo conectar.")}
        >
          Conectar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={requestUpdate.isPending}
          onClick={() =>
            runAction(
              () => requestUpdate.mutateAsync(agent.id),
              "Actualización remota no disponible todavía (Fase 6).",
            )
          }
        >
          Actualizar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={restart.isPending}
          onClick={() =>
            runAction(
              () => restart.mutateAsync(agent.id),
              "Reinicio remoto no disponible todavía (Fase 6).",
            )
          }
        >
          Reiniciar
        </Button>
        <Button size="sm" variant="danger" disabled={remove.isPending} onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Card>
  );
}
