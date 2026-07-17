import { Card, CardContent, CardHeader, CardTitle } from "@backuphub/ui";
import { cn } from "@backuphub/shared";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "success";
  hint?: string;
}

export function StatCard({ title, value, icon: Icon, tone = "default", hint }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent
        className={cn(
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </CardContent>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
