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

## Fase 2 — Autenticación

Implementada en `apps/api/src/modules/auth` y `apps/api/src/modules/users`:

- `POST /auth/register`, `POST /auth/login` — devuelven `accessToken`
  (15 min por defecto) + `refreshToken` (7 días).
- `POST /auth/refresh` — rota el refresh token (invalida el usado y
  emite uno nuevo).
- `POST /auth/logout` — revoca un refresh token concreto, o todas las
  sesiones del usuario si no se envía ninguno.
- `GET /auth/me` — perfil del usuario autenticado (requiere `Authorization: Bearer <accessToken>`).
- Contraseñas con bcrypt (10 salt rounds). Refresh tokens también se
  guardan hasheados en la tabla `Token`, nunca en texto plano.
- `JwtStrategy` (Passport) + `JwtAuthGuard` protegen las rutas que lo
  requieran con `@UseGuards(JwtAuthGuard)`.

En `apps/web`: páginas `/login` y `/register` (React Hook Form + Zod,
usando los esquemas de `@backuphub/auth`), y un store de sesión en
`src/stores/auth-store.ts` (Zustand, persistido en `localStorage`).

> **Nota de seguridad pendiente para más adelante (Fase 10):** el
> refresh token se persiste en `localStorage` por simplicidad de esta
> fase. Para producción es preferible moverlo a una cookie `httpOnly`
> emitida por la API, que no es accesible desde JavaScript y por tanto
> resiste mejor ataques XSS.

### Nota sobre los packages compartidos

`packages/types`, `config`, `auth`, `shared` y `ui` ahora tienen un
paso de build real (`tsc -p tsconfig.build.json` → `dist/`), en vez de
apuntar directamente a su código fuente TypeScript. Turborepo ya se
encarga de construirlos automáticamente en el orden correcto antes de
`apps/api` o `apps/web` (`turbo.json` → `build.dependsOn: ["^build"]`),
así que no hace falta ningún paso manual adicional: `pnpm build` o
`pnpm dev` siguen funcionando igual.

## Fase 3 — Dashboard

- `GET /dashboard/summary` (protegido con `JwtAuthGuard`) agrega en
  tiempo real: agentes online/total, planes activos, último backup con
  éxito, espacio usado/disponible (sumado de todos los agentes),
  backups fallidos en las últimas 24h, próximas ejecuciones pendientes
  y alertas sin resolver. Ver `apps/api/src/modules/dashboard`.
- La home (`/`) ahora es el dashboard real, protegido: si no hay
  sesión redirige a `/login` (`src/components/require-auth.tsx`).
  Se consume con TanStack Query (`src/hooks/use-dashboard-summary.ts`),
  refrescando cada 30s.
- Tarjetas de estado, gráfico de espacio usado/disponible (Recharts),
  panel de alertas y panel de próximos backups, todo construido sobre
  `@backuphub/ui`.
- Como los módulos de Agentes (Fase 4), Planes (Fase 5) y el motor del
  Agente (Fase 6) todavía no generan datos reales, el dashboard
  mostrará mayormente estados vacíos hasta esas fases — están
  diseñados a propósito para eso (ver `AlertsPanel`/`UpcomingPanel`).

### Nota de compatibilidad corregida

`@opennextjs/cloudflare` se había instalado en la `1.20.x`, que exige
Next 15+. Se fijó a `1.15.0` (última versión que sigue soportando
Next 14.2.x) y se subió `wrangler` a `^4.59.2` acorde a su peer
dependency. También se alineó `eslint` a la v8 en toda la web
(`eslint-config-next` de Next 14 no soporta el flat config de eslint 9).

## Fase 4 — Gestión de agentes (equipos)

- `apps/api/src/modules/agents`: `GET/POST /agents`, `GET/PATCH/DELETE
  /agents/:id`, `POST /agents/:id/sync`, `POST /agents/:id/restart`,
  `POST /agents/:id/update` — todos protegidos con `JwtAuthGuard`.
- **Conectar equipo** hace un ping real a `${apiUrl}/health` del Backup
  Agent (con timeout de 5s) y detecta automáticamente su SO y versión
  desde la respuesta — coherente con "la Web App detecta
  automáticamente los agentes" del documento de producto. Si el agente
  no responde, se rechaza el registro con un mensaje claro.
- Se añadió el campo `"os"` a `GET /health` del Backup Agent (Rust,
  `std::env::consts::OS`) para que ese auto-detect funcione.
- **Botones "Actualizar" y "Reiniciar"** están conectados de extremo a
  extremo pero devuelven `501 Not Implemented` a propósito: gestionar
  el proceso del agente en remoto requiere un endpoint del lado del
  agente que todavía no existe — llega con el motor de backup en la
  Fase 6. La UI lo comunica igual con un mensaje, no falla en silencio.
- Pantalla `/equipos`: tarjetas por equipo (nombre, SO, versión,
  estado, última sincronización, espacio libre) + diálogo para
  conectar un equipo nuevo. Enlace añadido al `Navbar`.

## Roadmap por fases

El proyecto se construye de forma incremental, fase a fase:

- [x] **Fase 1** — Arquitectura completa, estructura de carpetas,
      monorepo (Turborepo + pnpm), Docker, README.
- [x] **Fase 2** — Sistema de autenticación (JWT + refresh tokens).
- [x] **Fase 3** — Dashboard.
- [x] **Fase 4** — Gestión de agentes (equipos).
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
