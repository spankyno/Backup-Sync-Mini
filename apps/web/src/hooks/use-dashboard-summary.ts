import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DashboardSummary } from "@backuphub/types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
    refetchInterval: 30_000, // refresco automático cada 30s
  });
}
