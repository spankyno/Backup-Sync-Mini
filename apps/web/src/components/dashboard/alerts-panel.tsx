import { Badge, Card, CardHeader, CardTitle } from "@backuphub/ui";
import { formatRelativeTime } from "@backuphub/shared";
import type { Alert, AlertSeverity } from "@backuphub/types";

const toneBySeverity: Record<AlertSeverity, "info" | "warning" | "danger"> = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "danger",
};

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      {alerts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin alertas activas. Todo en orden.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm">{alert.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(alert.createdAt)}
                </p>
              </div>
              <Badge tone={toneBySeverity[alert.severity]}>{alert.severity}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
