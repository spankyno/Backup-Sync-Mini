"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@backuphub/ui";
import { RequireAuth } from "@/components/require-auth";
import { Navbar } from "@/components/dashboard/navbar";
import { Step1SourceSelection } from "@/components/wizard/step1-source";
import { Step2Destination } from "@/components/wizard/step2-destination";
import { Step3Configuration } from "@/components/wizard/step3-configuration";
import { Step4Summary } from "@/components/wizard/step4-summary";
import { initialWizardState, scheduleToCron, type WizardState } from "@/components/wizard/wizard-state";
import { useCreateBackupPlan, isApiError } from "@/hooks/use-backup-plans";

const STEP_TITLES = ["Origen", "Destino", "Configuración", "Resumen"];

export default function NuevoPlanPage() {
  return (
    <RequireAuth>
      <Navbar />
      <WizardContent />
    </RequireAuth>
  );
}

function WizardContent() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const createPlan = useCreateBackupPlan();

  const update = (patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch }));

  const canGoNext = () => {
    if (step === 1) return state.name.trim().length > 0 && state.sourcePaths.length > 0;
    if (step === 2) return state.destinationPath.trim().length > 0;
    return true;
  };

  const handleConfirm = async () => {
    try {
      await createPlan.mutateAsync({
        name: state.name,
        ...(state.description ? { description: state.description } : {}),
        agentId: state.agentId,
        sourcePaths: state.sourcePaths,
        destination: { type: state.destinationType, path: state.destinationPath },
        ...(scheduleToCron(state.scheduleFrequency)
          ? { schedule: scheduleToCron(state.scheduleFrequency) as string }
          : {}),
        versioningMax: state.versioningMax,
        compression: state.compression,
        encryption: state.encryption,
        excludeFilters: state.excludeFilters,
      });
      router.push("/planes");
    } catch {
      // el error ya se muestra debajo del botón vía createPlan.isError
    }
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Crear plan de backup</h1>
        <div className="mt-3 flex gap-2">
          {STEP_TITLES.map((title, index) => (
            <div
              key={title}
              className={`flex-1 rounded-full px-3 py-1.5 text-center text-xs font-medium ${
                index + 1 === step
                  ? "bg-primary text-primary-foreground"
                  : index + 1 < step
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}. {title}
            </div>
          ))}
        </div>
      </div>

      <Card>
        {step === 1 && (
          <Step1SourceSelection
            state={state}
            update={update}
            browsePath={browsePath}
            setBrowsePath={setBrowsePath}
          />
        )}
        {step === 2 && <Step2Destination state={state} update={update} />}
        {step === 3 && <Step3Configuration state={state} update={update} />}
        {step === 4 && <Step4Summary state={state} />}
      </Card>

      {createPlan.isError && (
        <p className="text-sm text-danger">
          {isApiError(createPlan.error)
            ? createPlan.error.message
            : "No se pudo crear el plan de backup."}
        </p>
      )}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
        >
          Atrás
        </Button>

        {step < 4 ? (
          <Button type="button" disabled={!canGoNext()} onClick={() => setStep((s) => s + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button type="button" disabled={createPlan.isPending} onClick={handleConfirm}>
            {createPlan.isPending ? "Creando..." : "Confirmar y crear plan"}
          </Button>
        )}
      </div>
    </main>
  );
}
