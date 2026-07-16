# Arquitectura de BackupHub

## Visión general

BackupHub separa la **experiencia de usuario** (siempre en el navegador)
de la **ejecución real de los backups** (siempre local, en la máquina del
usuario). Esto se traduce en dos aplicaciones independientes que nunca
se despliegan juntas:

```
┌─────────────────┐        HTTPS/WS        ┌──────────────────────┐
│      Web App     │ ─────────────────────▶ │        API           │
│   (Next.js)      │ ◀───────────────────── │      (NestJS)        │
└─────────────────┘                         └──────────┬───────────┘
                                                          │
                                              HTTPS (agentes remotos)
                                              HTTP localhost (agentes locales)
                                                          │
                                             ┌────────────▼────────────┐
                                             │      Backup Agent        │
                                             │   (Rust · Axum · :3845)  │
                                             └───────────────────────────┘
```

- La **Web App** nunca toca el sistema de archivos directamente.
- La **API** es la fuente de verdad: usuarios, planes, historial,
  inventario. Habla con los agentes registrados.
- El **Agent** es el único componente con acceso al disco. Expone una
  API REST local (`http://localhost:3845` por defecto) que solo la API
  (o la Web App, según el modo) puede invocar mediante token.

## Modos de funcionamiento

BackupHub está pensado para funcionar en dos modos, según el documento
de producto:

1. **Modo completamente local**: Web App + API corriendo en la misma
   máquina (o LAN) que el/los agentes, sin dependencia de un servidor
   remoto. Pensado para un usuario o equipo pequeño.
2. **Modo servidor**: API desplegada en un servidor central (Docker),
   con múltiples agentes conectándose desde distintos equipos/redes vía
   HTTPS. Pensado para escalar a varios equipos.

La arquitectura de dominio (planes, ejecuciones, inventario...) es la
misma en ambos modos; lo que cambia es dónde vive la API y cómo se
autentican los agentes remotos.

## Monorepo

Turborepo + pnpm workspaces:

- `apps/web` — Next.js (App Router), UI del producto.
- `apps/api` — NestJS, lógica de negocio y persistencia (Prisma).
- `apps/agent` — Rust/Axum, motor de backup local.
- `packages/ui` — Design system compartido (shadcn/ui + Tailwind).
- `packages/types` — Tipos de dominio compartidos (Agent, BackupPlan...).
- `packages/config` — Constantes y validación de entorno (Zod).
- `packages/auth` — Esquemas y contratos de autenticación compartidos.
- `packages/shared` — Utilidades (formateo, `cn`, etc).

## Comunicación Web App ↔ Agent

La Web App **nunca** habla directamente con el agente en modo servidor:
pasa siempre por la API, que actúa de proxy/orquestador y guarda el
estado (para eso existe la tabla `agents` con `apiUrl` y `authToken`).
En modo completamente local, la API puede convivir en la misma máquina
y seguir siendo el único punto de entrada al agente, manteniendo la
misma arquitectura en ambos modos.

## Seguridad por defecto

- Contraseñas nunca en texto plano (bcrypt).
- JWT de acceso de corta duración + refresh tokens.
- Tokens de agente único por equipo, rotables desde la Web App.
- AES-256 para los datos en tránsito/reposo gestionados por el agente.
- SHA-256 para verificación de integridad de cada archivo.
- Rate limiting en la API (`@nestjs/throttler`).

## Próximas fases

Ver `README.md` en la raíz para el roadmap completo por fases.
