import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Execution } from "@backuphub/types";

export function usePlanExecutions(planId: string) {
  return useQuery({
    queryKey: ["backup-plans", planId, "executions"],
    queryFn: () => apiClient.get<Execution[]>(`/backup-plans/${planId}/executions`),
    // Refresca rápido: si hay algo en curso queremos ver el progreso.
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = data?.some((e) => e.status === "RUNNING" || e.status === "PENDING");
      return hasActive ? 3_000 : 15_000;
    },
  });
}

export function useRunBackupPlan(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<Execution>(`/backup-plans/${planId}/run`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["backup-plans", planId, "executions"] }),
  });
}

export function useCancelExecution(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) =>
      apiClient.post<Execution>(`/executions/${executionId}/cancel`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["backup-plans", planId, "executions"] }),
  });
}
