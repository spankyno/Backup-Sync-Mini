import { IsString, IsUrl, MinLength } from "class-validator";

export class CreateAgentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // http://localhost:3845 en modo local, o una URL HTTPS (p.ej. un
  // túnel) cuando el agente está en otra red.
  @IsUrl({ require_tld: false })
  apiUrl!: string;

  // Debe coincidir con AGENT_TOKEN_SECRET configurado en ese agente.
  @IsString()
  @MinLength(8)
  authToken!: string;
}
