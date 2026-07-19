"use client";

import { Folder, FolderPlus, ArrowUp } from "lucide-react";
import { Button, Badge } from "@backuphub/ui";
import { useAgentFilesystem } from "@/hooks/use-agent-filesystem";

interface FolderBrowserProps {
  agentId: string;
  currentPath: string | null;
  onNavigate: (path: string) => void;
  onAddPath: (path: string) => void;
  selectedPaths: string[];
}

export function FolderBrowser({
  agentId,
  currentPath,
  onNavigate,
  onAddPath,
  selectedPaths,
}: FolderBrowserProps) {
  const { data, isLoading, isError, error } = useAgentFilesystem(agentId, currentPath);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Explorando el equipo...</p>;
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-danger">
        No se pudo conectar con el agente para listar carpetas.
        {error instanceof Error ? ` (${error.message})` : ""}
      </p>
    );
  }

  const folders = data.entries.filter((entry) => entry.is_dir);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      {data.quick_access.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.quick_access.map((qa) => (
            <button
              key={qa.path}
              type="button"
              onClick={() => onNavigate(qa.path)}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground" title={data.path}>
          {data.path}
        </p>
        <div className="flex shrink-0 gap-2">
          {data.parent && (
            <Button size="sm" variant="secondary" onClick={() => onNavigate(data.parent!)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" onClick={() => onAddPath(data.path)}>
            <FolderPlus className="mr-1 h-3.5 w-3.5" />
            Añadir esta carpeta
          </Button>
        </div>
      </div>

      <ul className="max-h-64 overflow-y-auto rounded-md border border-border">
        {folders.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">Sin subcarpetas aquí.</li>
        )}
        {folders.map((entry) => {
          const alreadySelected = selectedPaths.includes(entry.path);
          return (
            <li
              key={entry.path}
              className="flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted"
            >
              <button
                type="button"
                onClick={() => onNavigate(entry.path)}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <Folder className="h-4 w-4 text-muted-foreground" />
                {entry.name}
              </button>
              {alreadySelected ? (
                <Badge tone="success">Añadida</Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddPath(entry.path)}
                  className="text-xs text-primary hover:underline"
                >
                  Añadir
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
