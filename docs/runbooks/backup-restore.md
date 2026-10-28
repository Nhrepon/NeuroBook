# Runbook — Backup & Restore

## Daily (automated)
1. `pg_dump` of primary database, AES-256 encrypted.
2. Upload to object storage with versioning.
3. Verify checksum and record in audit log.

## Quarterly restore drill
1. Provision a clean Postgres instance.
2. Restore latest backup.
3. Run migrations and RLS assertion.
4. Smoke-test login, posting, and a report.
5. Document RTO/RPO achieved.

## Tenant export (offboarding)
- Run `tooling/tenant-export` to produce JSON + CSV bundle.
- Verify totals match a Trial Balance before handover.