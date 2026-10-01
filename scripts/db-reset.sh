#!/usr/bin/env bash
# Drop, recreate, and migrate the local DB. DESTRUCTIVE.
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Aborting."
  exit 1
fi
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
echo "DB reset + migrated."
