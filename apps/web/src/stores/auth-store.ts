import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession } from "@backuphub/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  logoutLocal: () => void;
  setHasHydrated: (value: boolean) => void;
}

// NOTA de seguridad: se persiste en localStorage por simplicidad de esta
// fase. Para producción es preferible mover el refresh token a una cookie
// httpOnly emitida por la API (requiere que Web y API compartan dominio
// raíz o SameSite=None + Secure), lo que evita exponerlo a XSS. Se deja
// como mejora para la Fase 10 (pulido y seguridad).
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoading: false,
      error: null,
      hasHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const session = await authRequest<AuthSession>("/auth/login", {
            email,
            password,
          });
          set({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            user: session.user,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false, error: toErrorMessage(err) });
          throw err;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const session = await authRequest<AuthSession>("/auth/register", {
            name,
            email,
            password,
          });
          set({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            user: session.user,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false, error: toErrorMessage(err) });
          throw err;
        }
      },

      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const session = await authRequest<AuthSession>("/auth/refresh", {
            refreshToken,
          });
          set({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            user: session.user,
          });
          return true;
        } catch {
          return false;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          await authRequest("/auth/logout", { refreshToken }, get().accessToken);
        } catch {
          // Si la llamada falla igualmente limpiamos la sesión local.
        }
        get().logoutLocal();
      },

      logoutLocal: () => {
        set({ accessToken: null, refreshToken: null, user: null });
      },

      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),
    }),
    {
      name: "backuphub-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);

async function authRequest<T = unknown>(
  path: string,
  body: unknown,
  bearerToken?: string | null,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "No se pudo completar la operación");
  }

  return res.json();
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Ha ocurrido un error inesperado";
}
