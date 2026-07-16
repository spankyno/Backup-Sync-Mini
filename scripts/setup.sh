#!/usr/bin/env bash
set -euo pipefail

# BackupHub - script de arranque para desarrollo local.
# Requiere: Node >= 20, pnpm >= 9, Rust (cargo), Docker (opcional).

echo "==> Verificando herramientas..."
command -v node >/dev/null || { echo "Falta Node.js >= 20"; exit 1; }
command -v pnpm >/dev/null || { echo "Falta pnpm >= 9 (npm i -g pnpm)"; exit 1; }
command -v cargo >/dev/null || echo "Aviso: falta Rust/cargo, necesario para apps/agent"

echo "==> Copiando .env de ejemplo (si no existe)..."
[ -f .env ] || cp .env.example .env

echo "==> Instalando dependencias del monorepo (web + api + packages)..."
pnpm install

echo "==> Levantando Postgres (Docker)..."
docker compose up -d postgres

echo "==> Generando cliente de Prisma y aplicando migraciones..."
pnpm db:generate
pnpm db:migrate

echo "==> Listo. Comandos útiles:"
echo "    pnpm dev          # web + api en modo desarrollo"
echo "    pnpm agent:dev     # backup agent (Rust) en modo desarrollo"
echo "    docker compose up  # todo el stack en contenedores"
