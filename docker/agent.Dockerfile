# syntax=docker/dockerfile:1
#
# Este Dockerfile NO se usa para "correr" el agente (el agente se instala
# de forma nativa en el equipo del usuario: Windows, Linux o macOS).
# Se usa únicamente en CI para compilar el binario de Linux de forma
# reproducible.

FROM rust:1.79-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY apps/agent ./apps/agent
WORKDIR /app/apps/agent
RUN cargo build --release

FROM debian:bookworm-slim AS artifact
COPY --from=build /app/apps/agent/target/release/backuphub-agent /out/backuphub-agent
