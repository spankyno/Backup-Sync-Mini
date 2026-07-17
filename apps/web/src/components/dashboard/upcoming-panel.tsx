import { Badge, Card, CardHeader, CardTitle } from "@backuphub/ui";
import { formatRelativeTime } from "@backuphub/shared";
import type { Execution } from "@backuphub/types";

export function UpcomingPanel({ executions }: { executions: Execution[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos backups</CardTitle>
      </CardHeader>
      {executions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No hay ejecuciones programadas todavía. Se activará en la Fase 5
          (planes de backup) y la Fase 6 (motor del agente).
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {executions.map((execution) => (
            <li key={execution.id} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {execution.startedAt
                  ? formatRelativeTime(execution.startedAt)
                  : "Sin programar"}
              </span>
              <Badge tone="info">{execution.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
