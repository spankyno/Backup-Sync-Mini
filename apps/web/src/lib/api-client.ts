import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  // Access token expirado: intenta refrescar una vez y repite la llamada.
  if (res.status === 401 && retry) {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) {
      return request<T>(path, options, false);
    }
    useAuthStore.getState().logoutLocal();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? "Error de red");
  }

  if (res.status === HTTP_NO_CONTENT) return undefined as T;
  return res.json();
}

const HTTP_NO_CONTENT = 204;

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
