import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Execution, BackupPlan } from "@backuphub/types";

export interface HistoryFilters {
  planId?: string | undefined;
  agentId?: string | undefined;
  status?: string | undefined;
  search?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export type ExecutionWithPlan = Execution & { backupPlan: BackupPlan };

function toQueryString(filters: HistoryFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useExecutionHistory(filters: HistoryFilters) {
  return useQuery({
    queryKey: ["executions", filters],
    queryFn: () =>
      apiClient.get<ExecutionWithPlan[]>(`/executions${toQueryString(filters)}`),
  });
}

export function buildExportUrl(filters: HistoryFilters): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return `${apiUrl}/executions/export${toQueryString(filters)}`;
}
