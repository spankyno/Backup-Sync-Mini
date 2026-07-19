import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface FilesystemEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface QuickAccessEntry {
  label: string;
  path: string;
}

export interface BrowseResponse {
  path: string;
  parent: string | null;
  entries: FilesystemEntry[];
  quick_access: QuickAccessEntry[];
}

export function useAgentFilesystem(agentId: string | null, path: string | null) {
  return useQuery({
    queryKey: ["agent-filesystem", agentId, path],
    queryFn: () => {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      return apiClient.get<BrowseResponse>(`/agents/${agentId}/filesystem${query}`);
    },
    enabled: !!agentId,
    retry: false,
  });
}
