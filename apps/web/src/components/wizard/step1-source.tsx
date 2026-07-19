"use client";

import { X } from "lucide-react";
import { Input, Label, Badge } from "@backuphub/ui";
import { useAgents } from "@/hooks/use-agents";
import { FolderBrowser } from "./folder-browser";
import type { WizardState } from "./wizard-state";

interface Step1Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  browsePath: string | null;
  setBrowsePath: (path: string | null) => void;
}

export function Step1SourceSelection({ state, update, browsePath, setBrowsePath }: Step1Props) {
  const { data: agents, isLoading } = useAgents();

  const addPath = (path: string) => {
    if (!state.sourcePaths.includes(path)) {
      update({ sourcePaths: [...state.sourcePaths, path] });
    }
  };

  const removePath = (path: string) => {
    update({ sourcePaths: state.sourcePaths.filter((p) => p !== path) });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-name">Nombre del plan</Label>
        <Input
          id="plan-name"
          placeholder="Backup diario de Documentos"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-select">Equipo</Label>
        <select
          id="agent-select"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={state.agentId}
          onChange={(e) => {
            update({ agentId: e.target.value, sourcePaths: [] });
            setBrowsePath(null);
          }}
        >
          <option value="">Selecciona un equipo...</option>
          {agents?.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.os})
            </option>
          ))}
        </select>
        {!isLoading && agents?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No tienes equipos conectados todavía. Ve a "Equipos" para conectar uno.
          </p>
        )}
      </div>

      {state.agentId && (
        <div className="flex flex-col gap-2">
          <Label>Carpetas de origen</Label>
          <FolderBrowser
            agentId={state.agentId}
            currentPath={browsePath}
            onNavigate={setBrowsePath}
            onAddPath={addPath}
            selectedPaths={state.sourcePaths}
          />
        </div>
      )}

      {state.sourcePaths.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Carpetas seleccionadas ({state.sourcePaths.length})</Label>
          <div className="flex flex-wrap gap-2">
            {state.sourcePaths.map((path) => (
              <Badge key={path} tone="info" className="flex items-center gap-1.5">
                <span className="max-w-[240px] truncate" title={path}>
                  {path}
                </span>
                <button type="button" onClick={() => removePath(path)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
