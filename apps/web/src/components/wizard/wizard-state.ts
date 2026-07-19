import type { DestinationType } from "@backuphub/types";
import { DEFAULT_EXCLUDE_FILTERS } from "@backuphub/config";

export interface WizardState {
  name: string;
  description: string;
  agentId: string;
  sourcePaths: string[];
  destinationType: DestinationType;
  destinationPath: string;
  scheduleFrequency: "manual" | "daily" | "weekly";
  versioningMax: number;
  compression: boolean;
  encryption: boolean;
  excludeFilters: string[];
}

export const initialWizardState: WizardState = {
  name: "",
  description: "",
  agentId: "",
  sourcePaths: [],
  destinationType: "FOLDER",
  destinationPath: "",
  scheduleFrequency: "daily",
  versioningMax: 10,
  compression: false,
  encryption: true,
  excludeFilters: [...DEFAULT_EXCLUDE_FILTERS],
};

/** Traduce la frecuencia elegida a una expresión cron (o null si es manual). */
export function scheduleToCron(frequency: WizardState["scheduleFrequency"]): string | null {
  switch (frequency) {
    case "daily":
      return "0 2 * * *"; // todos los días a las 2:00
    case "weekly":
      return "0 2 * * 0"; // domingos a las 2:00
    default:
      return null;
  }
}
