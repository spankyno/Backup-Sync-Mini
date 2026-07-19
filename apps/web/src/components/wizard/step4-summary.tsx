"use client";

import { Badge } from "@backuphub/ui";
import type { WizardState } from "./wizard-state";
import { useAgents } from "@/hooks/use-agents";

export function Step4Summary({ state }: { state: WizardState }) {
  const { data: agents } = useAgents();
  const agent = agents?.find((a) => a.id === state.agentId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-medium">{state.name || "(sin nombre)"}</h3>
        {state.description && (
          <p className="text-sm text-muted-foreground">{state.description}</p>
        )}
      </div>

      <SummaryRow label="Equipo" value={agent ? `${agent.name} (${agent.os})` : "—"} />

      <div>
        <p className="mb-1 text-sm font-medium">Carpetas de origen</p>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {state.sourcePaths.map((p) => (
            <li key={p} className="truncate">
              {p}
            </li>
          ))}
        </ul>
      </div>

      <SummaryRow
        label="Destino"
        value={`${state.destinationType} — ${state.destinationPath || "(sin ruta)"}`}
      />
      <SummaryRow
        label="Programación"
        value={
          state.scheduleFrequency === "manual"
            ? "Manual"
            : state.scheduleFrequency === "daily"
              ? "Diaria (2:00)"
              : "Semanal (domingos 2:00)"
        }
      />
      <SummaryRow label="Versionado" value={`${state.versioningMax} versiones máx.`} />
      <SummaryRow
        label="Compresión / Encriptación"
        value={`${state.compression ? "Sí" : "No"} / ${state.encryption ? "Sí" : "No"}`}
      />

      <div>
        <p className="mb-1 text-sm font-medium">Filtros excluidos</p>
        <div className="flex flex-wrap gap-1.5">
          {state.excludeFilters.map((f) => (
            <Badge key={f} tone="neutral">
              {f}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        Archivos, espacio y tiempo estimado se calcularán aquí en cuanto el
        motor del agente (Fase 6) pueda escanear las carpetas de origen. Al
        confirmar, el plan se crea y queda listo para ejecutarse cuando esa
        fase esté disponible.
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
