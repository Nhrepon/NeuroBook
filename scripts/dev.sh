#!/usr/bin/env bash
# Dev script: Postgres + Redis + MinIO via docker compose, then web dev.
# Mobile dev runs in a second terminal via `npm run dev:mobile`.
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose up -d
echo "Infra: Postgres :5432, Redis :6379, MinIO :9000 (console :9001)"
echo "Run: npm run dev:web    (Next.js 16)"
echo "      npm run dev:mobile (Expo SDK 57, New Architecture)"
