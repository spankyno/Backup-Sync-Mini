# BackupHub

> Aplicación web moderna que controla uno o varios **Backup Agents**
> locales. Local-first, offline-first, seguridad por defecto.

BackupHub no es una app de escritorio tradicional: toda la experiencia
de usuario vive en el navegador, mientras que los backups se ejecutan
mediante un agente ligero instalado en cada equipo (Windows, Linux o
macOS). Ver [`docs/architecture.md`](./docs/architecture.md) para el
detalle completo.

## Estructura del monorepo

```
backuphub/
├── apps/
│   ├── web/      → Next.js 14 (App Router) + Tailwind + shadcn/ui
│   ├── api/       → NestJS + Prisma + JWT + WebSockets + Swagger
│   └── agent/      → Rust + Axum + SQLite + Tokio
│
├── packages/
│   ├── ui/         → Design system compartido
│   ├── types/       → Tipos de dominio (Agent, BackupPlan, Execution...)
│   ├── config/       → Constantes y validación de entorno (Zod)
│   ├── auth/          → Esquemas de autenticación compartidos
│   └── shared/          → Utilidades (formateo, cn, etc)
│
├── docker/                → Dockerfiles de cada app
├── docs/                    → Documentación de arquitectura
├── scripts/                   → Scripts de desarrollo
└── turbo.json                   → Configuración de Turborepo
```

## Stack

| Capa | Tecnologías |
|---|---|
| Frontend | Next.js, React, TypeScript, TailwindCSS, shadcn/ui, TanStack Query, Zustand, Framer Motion, React Hook Form, Zod |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL (SQLite en dev), JWT, WebSockets, Swagger |
| Agent | Rust, Axum, SQLite, Tokio, AES-256, SHA-256, watchdog de filesystem |

## Requisitos

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- Rust (`rustup`) para trabajar en `apps/agent`
- Docker + Docker Compose (opcional, para Postgres y despliegue)

## Puesta en marcha

```bash
cp .env.example .env
pnpm install

# Postgres vía Docker
docker compose up -d postgres

# Prisma
pnpm db:generate
pnpm db:migrate

# Desarrollo (web + api en paralelo, gestionado por Turborepo)
pnpm dev

# Backup Agent (en otra terminal, requiere Rust)
pnpm agent:dev
```

O simplemente:

```bash
./scripts/setup.sh
```

La Web App queda en `http://localhost:3000`, la API en
`http://localhost:4000` (Swagger en `/api/docs`) y el Agent en
`http://localhost:3845`.

### Todo en Docker

```bash
docker compose up --build
```

(El Agent **no** se dockeriza: se instala de forma nativa en cada
equipo que se quiere respaldar).

## Despliegue de la Web en Cloudflare Workers

La **Web App** (`apps/web`) se despliega en Cloudflare Workers mediante
el adaptador oficial `@opennextjs/cloudflare`. La **API** (`apps/api`)
**no** vive en Cloudflare: sigue corriendo en Docker/VPS tal cual está
descrito arriba (`docker compose up`), y la Web solo le habla vía
`NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`.

```bash
cd apps/web
pnpm install

# build + preview local en el runtime real de Workers (workerd)
pnpm cf:preview

# build + deploy a Cloudflare (requiere `wrangler login` una vez)
pnpm cf:deploy
```

O desde la raíz del monorepo: `pnpm web:cf:deploy`.

Antes de desplegar a producción:

1. Edita `apps/web/wrangler.jsonc` y pon la URL real de tu API
   (`NEXT_PUBLIC_API_URL` en HTTPS, `NEXT_PUBLIC_WS_URL` en WSS) — la
   API en Docker/VPS necesita estar detrás de un dominio con TLS
   (Cloudflare Tunnel, un reverse proxy con Let's Encrypt, etc.), ya
   que un Worker en Cloudflare no puede llamar a `http://localhost`.
   Ver [`docs/cloudflare-tunnel.md`](./docs/cloudflare-tunnel.md) para
   dejar la API con TLS vía Cloudflare Tunnel paso a paso.
2. Si usas algún secreto (no público) en la web, súbelo con
   `wrangler secret put NOMBRE_VARIABLE` en vez de meterlo en
   `wrangler.jsonc`.
3. `pnpm cf:typegen` regenera los tipos de los bindings de Cloudflare
   si en el futuro añades KV, R2 o D1 al Worker de la web.

La CORS de la API (`apps/api`) deberá permitir el origen
`*.workers.dev` / tu dominio custom de Cloudflare una vez desplegada.

## Roadmap por fases

El proyecto se construye de forma incremental, fase a fase:

- [x] **Fase 1** — Arquitectura completa, estructura de carpetas,
      monorepo (Turborepo + pnpm), Docker, README.
- [ ] **Fase 2** — Sistema de autenticación (JWT + refresh tokens).
- [ ] **Fase 3** — Dashboard.
- [ ] **Fase 4** — Gestión de agentes (equipos).
- [ ] **Fase 5** — Planes de backup (wizard de 4 pasos).
- [ ] **Fase 6** — Motor del agente (incremental, hashes, versionado,
      verificación, cancelación/reanudación, compresión, encriptación).
- [ ] **Fase 7** — Historial.
- [ ] **Fase 8** — Restauración.
- [ ] **Fase 9** — Inventario.
- [ ] **Fase 10** — Pulido, optimización y pruebas.

## Convenciones de código

- TypeScript estricto en todo el monorepo TS (`tsconfig.base.json`).
- Arquitectura limpia + DDD ligero: cada dominio de la API es un
  módulo de NestJS independiente (`src/modules/<dominio>`).
- Componentes de UI reutilizables centralizados en `@backuphub/ui`.
- Sin lógica de dominio duplicada entre `web` y `api`: los contratos
  compartidos viven en `@backuphub/types` y `@backuphub/auth`.
