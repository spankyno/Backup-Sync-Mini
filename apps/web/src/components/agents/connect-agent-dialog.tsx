"use client";

import { useForm } from "react-hook-form";
import { Button, Dialog, Input, Label } from "@backuphub/ui";
import { useCreateAgent, isApiError, type CreateAgentInput } from "@/hooks/use-agents";

export function ConnectAgentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createAgent = useCreateAgent();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAgentInput>();

  const onSubmit = async (data: CreateAgentInput) => {
    await createAgent.mutateAsync(data);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Conectar un equipo">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          El Backup Agent debe estar ya instalado y en marcha en ese equipo.
          Necesitas su URL local (p.ej. <code>http://localhost:3845</code>) y
          el <code>AGENT_TOKEN_SECRET</code> configurado en su <code>.env</code>.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nombre del equipo</Label>
          <Input
            id="name"
            placeholder="Portátil de Ana"
            error={errors.name?.message}
            {...register("name", { required: "Obligatorio" })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apiUrl">URL del agente</Label>
          <Input
            id="apiUrl"
            placeholder="http://localhost:3845"
            error={errors.apiUrl?.message}
            {...register("apiUrl", { required: "Obligatorio" })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="authToken">Token del agente</Label>
          <Input
            id="authToken"
            type="password"
            placeholder="AGENT_TOKEN_SECRET"
            error={errors.authToken?.message}
            {...register("authToken", { required: "Obligatorio" })}
          />
        </div>

        {createAgent.isError && (
          <p className="text-sm text-danger">
            {isApiError(createAgent.error)
              ? createAgent.error.message
              : "No se pudo conectar con el agente."}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createAgent.isPending}>
            {createAgent.isPending ? "Conectando..." : "Conectar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
