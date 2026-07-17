# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/agent/Cargo.toml ./apps/agent/Cargo.toml
COPY packages ./packages
# Instalacion completa (no filtrada): la API depende en build-time de
# @backuphub/types, config, auth y shared, que a su vez necesitan sus
# propias devDependencies (typescript) para compilar.
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY apps/api ./apps/api
RUN pnpm --filter @backuphub/api prisma:generate
# Construye primero los packages de los que depende la API (turbo
# resuelve el orden via su grafo de dependencias) y despues la API.
RUN pnpm exec turbo run build --filter=@backuphub/api...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
