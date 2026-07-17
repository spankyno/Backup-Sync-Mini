import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Agent } from "@backuphub/types";

const AGENTS_KEY = ["agents"] as const;

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn: () => apiClient.get<Agent[]>("/agents"),
    refetchInterval: 20_000,
  });
}

export interface CreateAgentInput {
  name: string;
  apiUrl: string;
  authToken: string;
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => apiClient.post<Agent>("/agents", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}

export function useSyncAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<Agent>(`/agents/${id}/sync`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}

export function useRestartAgent() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/agents/${id}/restart`),
  });
}

export function useRequestAgentUpdate() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/agents/${id}/update`),
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/agents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
