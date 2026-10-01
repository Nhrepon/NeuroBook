#!/usr/bin/env bash
# O2: backups are only real if restored. Run pg_dump, then verify with
# `scripts/restore-verify.sh`. Cron: nightly at 02:00 via Vercel Cron or
# external scheduler.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -z "${DATABASE_URL:-}" ] && { echo "DATABASE_URL not set"; exit 1; }
[ -z "${BACKUP_BUCKET:-}" ] && { echo "BACKUP_BUCKET not set"; exit 1; }

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="neurobook-${STAMP}.dump"
pg_dump --format=custom --no-owner --file="/tmp/${OUT}" "$DATABASE_URL"
# Encrypt (R16) with age or openssl — left to the operator's KMS choice.
echo "Backup written: /tmp/${OUT}"
echo "Upload to s3://${BACKUP_BUCKET}/backups/${OUT} via your uploader."
