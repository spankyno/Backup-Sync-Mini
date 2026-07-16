import { z } from "zod";

// Estos esquemas los usan tanto la Web App (react-hook-form + zod
// resolver) como la API (class-validator complementado con estos
// mismos contratos), para no duplicar reglas de validacion.

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export interface JwtAccessPayload {
  sub: string; // userId
  email: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends AuthTokens {
  user: {
    id: string;
    name: string;
    email: string;
    role: JwtAccessPayload["role"];
  };
}
