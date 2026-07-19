"use client";

import { Input, Label } from "@backuphub/ui";
import { cn } from "@backuphub/shared";
import type { DestinationType } from "@backuphub/types";
import type { WizardState } from "./wizard-state";

const DESTINATION_OPTIONS: { value: DestinationType; label: string }[] = [
  { value: "USB", label: "USB" },
  { value: "NAS", label: "NAS" },
  { value: "LOCAL_DISK", label: "Disco local" },
  { value: "FOLDER", label: "Carpeta" },
  { value: "SERVER", label: "Servidor" },
];

export function Step2Destination({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Tipo de destino</Label>
        <div className="flex flex-wrap gap-2">
          {DESTINATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ destinationType: option.value })}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                state.destinationType === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="destination-path">Ruta del destino</Label>
        <Input
          id="destination-path"
          placeholder={placeholderFor(state.destinationType)}
          value={state.destinationPath}
          onChange={(e) => update({ destinationPath: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {state.destinationType === "SERVER" || state.destinationType === "NAS"
            ? "Ruta o dirección accesible desde el equipo de origen (p.ej. una carpeta de red montada)."
            : "Ruta local visible para el agente en ese equipo."}
        </p>
      </div>
    </div>
  );
}

function placeholderFor(type: DestinationType): string {
  switch (type) {
    case "USB":
      return "/media/usb-backup";
    case "NAS":
      return "//nas.local/backups";
    case "LOCAL_DISK":
      return "D:\\Backups";
    case "SERVER":
      return "backups.miempresa.com:/data";
    default:
      return "/home/usuario/Backups";
  }
}
