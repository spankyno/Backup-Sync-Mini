import { z } from "zod";

// Constantes compartidas de la plataforma
export const AGENT_DEFAULT_PORT = 3845;

export const DEFAULT_EXCLUDE_FILTERS = [
  "node_modules",
  ".git",
  "temp",
  "cache",
];

export const QUICK_ACCESS_FOLDERS = [
  "Documentos",
  "Escritorio",
  "Imágenes",
  "Vídeos",
  "Descargas",
  "Proyectos",
] as const;

// Esquema de validación de variables de entorno de la Web App.
// Cada app puede extenderlo o definir el suyo propio si necesita
// variables adicionales.
export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url(),
});

export const apiEnvSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  // Lista separada por comas de orígenes permitidos para CORS, p.ej:
  // "https://backuphub.example.com,https://backuphub-web.workers.dev"
  ALLOWED_ORIGINS: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
