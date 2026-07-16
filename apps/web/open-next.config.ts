import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// BackupHub - Web App en Cloudflare Workers.
// La API (NestJS) NO se despliega aquí: sigue en Docker/VPS. Este Worker
// solo sirve el frontend y llama a la API vía NEXT_PUBLIC_API_URL.
//
// Cache por defecto en memoria; se puede sustituir por R2/KV para ISR
// en producción cuando haga falta (ver docs de OpenNext).
export default defineCloudflareConfig();
