# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/agent/Cargo.toml ./apps/agent/Cargo.toml
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY apps/web ./apps/web
# Construye primero los packages de los que depende la web y despues la web.
RUN pnpm exec turbo run build --filter=@backuphub/web...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
