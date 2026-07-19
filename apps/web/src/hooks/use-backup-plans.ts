import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import type { BackupPlan, DestinationType } from "@backuphub/types";

const PLANS_KEY = ["backup-plans"] as const;

export function useBackupPlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: () => apiClient.get<BackupPlan[]>("/backup-plans"),
  });
}

export interface CreateBackupPlanInput {
  name: string;
  description?: string;
  agentId: string;
  sourcePaths: string[];
  destination: { type: DestinationType; path: string };
  schedule?: string;
  versioningMax: number;
  compression: boolean;
  encryption: boolean;
  excludeFilters: string[];
  tags?: string[];
}

export function useCreateBackupPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBackupPlanInput) =>
      apiClient.post<BackupPlan>("/backup-plans", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLANS_KEY }),
  });
}

export function useSetBackupPlanStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" }) =>
      apiClient.post<BackupPlan>(`/backup-plans/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLANS_KEY }),
  });
}

export function useDeleteBackupPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/backup-plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLANS_KEY }),
  });
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
