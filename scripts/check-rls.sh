#!/usr/bin/env bash
# R9: assert every tenant-scoped table has an RLS policy. CI gate.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -z "${DATABASE_URL:-}" ] && { echo "DATABASE_URL not set"; exit 1; }

EXPECTED=(accounts vouchers journal_lines parties products users sessions audit_log fiscal_periods voucher_sequences idempotency_keys invoices)
for t in "${EXPECTED[@]}"; do
  count=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='$t' AND policyname='tenant_isolation';")
  if [ "$count" != "1" ]; then
    echo "R9 VIOLATION: table '$t' has $count tenant_isolation policies (expected 1)."
    exit 1
  fi
done
echo "R9 OK: ${#EXPECTED[@]} tables have tenant_isolation policy."
