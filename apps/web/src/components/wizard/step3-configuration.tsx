"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input, Label, Switch, Badge, Button } from "@backuphub/ui";
import type { WizardState } from "./wizard-state";

export function Step3Configuration({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  const [newFilter, setNewFilter] = useState("");

  const addFilter = () => {
    const value = newFilter.trim();
    if (value && !state.excludeFilters.includes(value)) {
      update({ excludeFilters: [...state.excludeFilters, value] });
    }
    setNewFilter("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label>Programación</Label>
        <div className="flex gap-2">
          {(
            [
              { value: "manual", label: "Manual" },
              { value: "daily", label: "Diario" },
              { value: "weekly", label: "Semanal" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ scheduleFrequency: option.value })}
              className={
                state.scheduleFrequency === option.value
                  ? "rounded-full border border-primary bg-primary px-4 py-1.5 text-sm text-primary-foreground"
                  : "rounded-full border border-border px-4 py-1.5 text-sm hover:bg-muted"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:w-48">
        <Label htmlFor="versioning-max">Número máximo de versiones</Label>
        <Input
          id="versioning-max"
          type="number"
          min={1}
          max={100}
          value={state.versioningMax}
          onChange={(e) => update({ versioningMax: Number(e.target.value) || 1 })}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Switch
          checked={state.compression}
          onCheckedChange={(v) => update({ compression: v })}
          label="Compresión"
        />
        <Switch
          checked={state.encryption}
          onCheckedChange={(v) => update({ encryption: v })}
          label="Encriptación (AES-256)"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Filtros — excluir</Label>
        <div className="flex flex-wrap gap-2">
          {state.excludeFilters.map((filter) => (
            <Badge key={filter} tone="neutral" className="flex items-center gap-1.5">
              {filter}
              <button
                type="button"
                onClick={() =>
                  update({ excludeFilters: state.excludeFilters.filter((f) => f !== filter) })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="p.ej. *.tmp"
            value={newFilter}
            onChange={(e) => setNewFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFilter();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addFilter}>
            Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}
