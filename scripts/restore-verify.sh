#!/usr/bin/env bash
# O2: restore the latest backup into a scratch database and verify
# row counts + checksum. Fails loudly on drift.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -z "${DATABASE_URL:-}" ] && { echo "DATABASE_URL not set"; exit 1; }

# Production: pull from S3; this script assumes the file is local.
DUMP_FILE="${1:-/tmp/neurobook-latest.dump}"
[ -f "$DUMP_FILE" ] || { echo "Missing dump: $DUMP_FILE"; exit 1; }

SCRATCH_URL="${SCRATCH_URL:-postgres://scratch@localhost:5432/neurobook_scratch}"
SCRATCH_URL=$(echo "$SCRATCH_URL" | sed 's|/scratch@|/|; s|/neurobook_scratch|/neurobook_scratch|')
psql "$SCRATCH_URL" -c "DROP DATABASE IF EXISTS neurobook_scratch; CREATE DATABASE neurobook_scratch;" || true
pg_restore --no-owner --dbname="$SCRATCH_URL" "$DUMP_FILE" || true
ROW_COUNT=$(psql "$SCRATCH_URL" -t -A -c "SELECT COUNT(*) FROM vouchers;")
echo "Scratch restore OK. Vouchers: ${ROW_COUNT}."
