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

## Fase 5 — Planes de backup

- **Agent (Rust):** `GET /api/v1/filesystem/browse?path=...` ahora lista
  carpetas reales del equipo (con accesos rápidos que solo aparecen si
  existen: Documentos, Escritorio, Imágenes, Vídeos, Descargas,
  Proyectos). Se protegió **todo** `/api/v1/*` con un middleware de
  token (comparación en tiempo constante) — antes existía la función
  de verificación pero no se usaba en ningún sitio. `/health` sigue
  público a propósito, para que "Conectar equipo" funcione antes de
  tener nada más configurado.
- **API:** `GET /agents/:id/filesystem` proxea ese listado (la Web
  nunca llama al agente directamente). Nuevo módulo
  `apps/api/src/modules/backup-plans` con CRUD completo +
  `POST /backup-plans/:id/pause` `/resume`.
- **Web:** wizard de 4 pasos en `/planes/nuevo` (Origen → Destino →
  Configuración → Resumen) con explorador de carpetas real navegable,
  y listado de planes en `/planes` con pausar/reanudar/eliminar.
- Los campos "Archivos", "Espacio" y "Tiempo estimado" del resumen
  (Paso 4) se muestran como pendientes a propósito: escanear el
  contenido real de las carpetas es trabajo del motor del agente
  (Fase 6), que es quien tiene acceso al disco.
- Se añadieron `Dialog`, `Switch` e `Input`/`Label` a `@backuphub/ui`
  (los dos primeros no existían todavía).

### Aviso sobre el agente (Rust)

Los cambios en `apps/agent` (middleware de auth + listado de carpetas)
no se pudieron compilar en este sandbox (no hay `cargo` disponible
aquí). Se revisaron a mano con cuidado, pero confírmalo con
`pnpm agent:dev` o `cargo build` en tu Codespace/máquina antes de
darlo por bueno — avísame si `cargo` señala algún error, se corrige
rápido.

## Fase 6 — Motor del agente

**Agent (Rust)**, todo nuevo en `apps/agent/src`:

- `core/scanner.rs`: recorrido recursivo de las carpetas de origen,
  hash SHA-256 de cada archivo **en streaming** (bloques de 1MB, no
  carga el archivo entero en RAM — importante para vídeos/archivos
  grandes), y filtros de exclusión (`node_modules`, `.git`, `*.tmp`, etc).
- `core/engine.rs`: el motor en sí.
  - **Incremental**: compara el hash contra el último conocido
    (SQLite local, tabla `agent_files`) y solo copia lo que cambió.
  - **Versionado**: cada ejecución escribe en
    `<destino>/<planId>/<executionId>/`; al terminar, se podan las
    versiones más antiguas por encima de `versioningMax`.
  - **Verificación**: tras escribir cada archivo, se relee **desde
    disco** (no desde el buffer en memoria), se descifra/descomprime
    si aplica, y se compara el hash contra el original — detecta
    corrupción real de escritura, no solo errores lógicos.
  - **Cancelación**: cada ejecución tiene su propio
    `CancellationToken`; se comprueba entre archivo y archivo (no
    interrumpe una escritura a mitad).
  - **Reanudación**: cada archivo copiado se marca `done` en
    `agent_execution_files`; si se reintenta la misma `executionId`,
    los ya copiados se saltan.
  - **Compresión** (gzip) y **encriptación** (AES-256-GCM) opcionales,
    combinables, aplicadas en ese orden al escribir.
  - **Logs**: cada paso relevante se guarda en SQLite
    (`agent_logs`) y también sale por la consola del proceso.
- `api/backups.rs`: `POST /api/v1/backups` (arranca, en una tarea de
  tokio aparte — no bloquea el servidor), `GET /:id` (estado y
  progreso), `GET /:id/logs`, `POST /:id/cancel`.
- **Todo `/api/v1/*` ya requiere el token** desde la Fase 5; no hubo
  que tocar eso.
- Nuevo `AGENT_ENCRYPTION_KEY` (separado de `AGENT_TOKEN_SECRET`) para
  la clave de cifrado — si no se define, se deriva de
  `AGENT_TOKEN_SECRET` con un aviso en el log, para no romper el
  arranque de quien todavía no lo haya configurado aparte.

**API (NestJS):** `apps/api/src/modules/executions` pasa de stub a
real: `POST /backup-plans/:id/run` (crea la `Execution` en Postgres y
le pide al agente que arranque), `GET /executions/:id` (vuelve a
preguntarle al agente y sincroniza Postgres — patrón *pull*, no hay
canal inverso agente→API), `POST /executions/:id/cancel`,
`GET /executions/:id/logs`.

**Web:** en `/planes`, cada plan ahora tiene botón "Ejecutar ahora" /
"Cancelar", con el estado de la última ejecución (archivos, bytes,
error si lo hay) refrescándose cada 3s mientras está en curso.

### Aviso importante sobre este motor

Todo `apps/agent` (scanner, motor, criptografía, endpoints HTTP) se
escribió sin poder compilarlo — este sandbox no tiene `cargo`
instalado. Se revisó exhaustivamente a mano (tipos, ownership,
firmas de las crates usadas), pero es la pieza de código con más
riesgo de todo el proyecto hasta ahora por ese motivo. **Antes de usar
esto con datos reales**, corre `cargo build` (o `pnpm agent:dev`) en tu
Codespace/máquina y avísame de cualquier error de compilación — se
corrige rápido, pero hay que verificarlo con el compilador real de
Rust, algo que yo no puedo hacer desde aquí.

## Fase 7 — Historial

- **Agent (Rust):** nuevo `GET /api/v1/backups/:id/files` — manifiesto
  de archivos copiados en una ejecución (ruta, hash, tamaño). La tabla
  local `agent_execution_files` ahora también guarda `hash`/`size` por
  archivo, no solo el estado `done`/`failed`.
- **API:** cuando `ExecutionsService.sync()` detecta que una ejecución
  terminó en `SUCCESS`, sincroniza ese manifiesto a Postgres creando
  una `Version` + sus `File` (con el hash de cada uno) — así el
  Historial no depende de que el agente esté online para mostrar
  hashes/archivos antiguos.
  - `GET /executions` — historial completo con filtros: `planId`,
    `agentId`, `status`, `search` (busca en el nombre del plan o el
    mensaje de error), `from`/`to` (rango de fechas).
  - `GET /executions/export` — mismo filtro, devuelve un CSV
    (`Content-Disposition: attachment`) con Plan/Inicio/Fin/Duración/
    Estado/Archivos/Bytes/Error.
  - `GET /executions/:id/files` — archivos + hashes de una ejecución
    ya sincronizada.
- **Web:** pantalla `/historial` con filtros (plan, estado, rango de
  fechas, búsqueda) y botón "Exportar CSV" (descarga autenticada vía
  `fetch` + blob, no un link directo, porque el token va en el header
  `Authorization`, no en cookies).

### Aviso sobre el agente (Rust)

Los cambios de esta fase en `apps/agent` (columnas nuevas + el
endpoint `/files`) son pequeños y aditivos comparados con el motor de
la Fase 6, pero **siguen sin poder compilarse en este sandbox** (no
hay `cargo` aquí). Verifícalo con `cargo build` igual que en la fase
anterior.

## Roadmap por fases

El proyecto se construye de forma incremental, fase a fase:

- [x] **Fase 1** — Arquitectura completa, estructura de carpetas,
      monorepo (Turborepo + pnpm), Docker, README.
- [x] **Fase 2** — Sistema de autenticación (JWT + refresh tokens).
- [x] **Fase 3** — Dashboard.
- [x] **Fase 4** — Gestión de agentes (equipos).
- [x] **Fase 5** — Planes de backup (wizard de 4 pasos).
- [x] **Fase 6** — Motor del agente (incremental, hashes, versionado,
      verificación, cancelación/reanudación, compresión, encriptación).
- [x] **Fase 7** — Historial.
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
