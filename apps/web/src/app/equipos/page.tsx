"use client";

import { useState } from "react";
import { Button } from "@backuphub/ui";
import { RequireAuth } from "@/components/require-auth";
import { Navbar } from "@/components/dashboard/navbar";
import { AgentCard } from "@/components/agents/agent-card";
import { ConnectAgentDialog } from "@/components/agents/connect-agent-dialog";
import { useAgents } from "@/hooks/use-agents";

export default function EquiposPage() {
  return (
    <RequireAuth>
      <Navbar />
      <EquiposContent />
    </RequireAuth>
  );
}

function EquiposContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: agents, isLoading, isError } = useAgents();

  return (
    <main className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equipos</h1>
          <p className="text-sm text-muted-foreground">
            Equipos con el Backup Agent instalado y sus tokens de conexión.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Conectar equipo</Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando equipos...</p>
      )}

      {isError && (
        <p className="text-sm text-danger">
          No se pudieron cargar los equipos. Comprueba que la API esté
          accesible.
        </p>
      )}

      {agents && agents.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Todavía no has conectado ningún equipo. Instala el Backup Agent y
          pulsa &quot;Conectar equipo&quot; para empezar.
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <ConnectAgentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </main>
  );
}
