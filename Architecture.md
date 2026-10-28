# NeuroBook — Accounting Platform Architecture (Tally Prime Alternative)

> **Revision:** Target architecture for a full rewrite · Next.js 16 + React 19 (web) · Expo SDK 58 / React Native 0.88 (mobile) · PostgreSQL 16
> **Principle:** Server-authoritative accounting, offline-first clients, integer money, accessible and keyboard-first UX.

---

## 1. Product Vision

NeuroBook is a Bangladesh-first accounting platform (Tally Prime alternative) for SMEs and accountants.
It must be **correct first**: no unbalanced vouchers, no lost tenants, no silent rounding, no data loss on flaky networks.
It must be **fast to operate**: keyboard-first data entry, instant feedback, predictable navigation.
It must be **compliant**: NBR VAT/TDS/Mushak flows and Bangladesh fiscal-year conventions are first-class, not add-ons.

Primary clients:

| Platform | Technology | Target |
| --- | --- | --- |
| Web | Next.js 16 (App Router, React 19, Turbopack) | SaaS / hosted browser app |
| Mobile | React Native via Expo SDK 58 (New Architecture, RN 0.88) | iOS, Android, offline-first |
| Desktop | Tauri 2 (Rust + system webview) or Electron | Offline-first desktop, local DB, printing, file export |
| API | Versioned REST (`/api/v1/*`) + Server Actions | Shared by both clients |

---

## 2. Architecture Principles

1. **Server is the source of truth.** Clients are views and editors; posting, sequencing, and balancing happen on the server.
2. **Money is integer minor units (taka × 100).** No float anywhere. Rounding is explicit and routed to a dedicated account.
3. **Tenant isolation is enforced by the database (RLS),** not only by application filters.
4. **Offline is a normal state, not an error.** Mobile reads from local SQLite and queues writes; the server reconciles.
5. **Accessibility and keyboard operability are release criteria,** not polish.
6. **Every mutation is auditable and reversible through history,** never by silent deletion.
7. **Contracts are versioned and validated on both sides** so installed mobile apps never break silently.
8. **Prefer boring, well-understood technology** over novelty where money is involved.
9. **Append-only ledger**: posted entries are never edited; corrections are new vouchers linked to the original.
10. **Serializable posting**: voucher posts run under `SERIALIZABLE` (or row locks) so concurrent edits cannot corrupt balances.
11. **Graceful degradation**: read paths survive partial outages; writes fail loudly with retry guidance.

---

## 3. Repository Layout (Monorepo)

Use a monorepo so the ledger engine, schemas, and formatters are compiled once and shared.

```
neurobook/
├── apps/
│   ├── web/                      # Next.js 16 — UI + API + DB access
│   ├── mobile/                   # Expo — offline-first client
│   └── desktop/                  # Tauri/Electron — offline-first desktop client
├── packages/
│   ├── shared/                   # Pure JS boundary (no framework, no node:* in client path)
│   │   ├── types/                # Domain types
│   │   ├── schemas/              # Zod schemas (request/response/DB)
│   │   ├── ledger/               # Double-entry engine, voucher types, reports
│   │   ├── money/                # Minor units, formatting, rounding
│   │   ├── auth/                 # JWT helpers, TOTP, rate-limit interface
│   │   └── format/               # BD number/date/Mushak formatters
│   ├── ui-tokens/                # Design tokens shared by web + native
│   └── config/                   # Shared TS/ESLint/Tailwind presets
├── tooling/                      # Scripts, db seeds, generators
├── docs/                         # Architecture, ADRs, runbooks
├── migrations/                   # SQL migrations (RLS lives here)
├── tests/                        # Cross-package contract & e2e
├── package.json                  # Workspace root
└── docker-compose.yml            # Postgres, Redis, MinIO
```

Rules:
- `packages/shared` must remain framework-free and importable by both web and mobile.
- `apps/*` never import each other; they communicate through the REST contract.
- All cross-boundary types come from `packages/shared`, never duplicated.

---

## 4. System Context

```
┌──────────────┐     HTTPS/JWT      ┌─────────────────────────────┐
│  Web (RSC)   │ ─────────────────► │  Next.js (proxy.ts)         │
│  Browser     │                    │  auth + tenant scope        │
└──────────────┘                    └─────────────┬───────────────┘
                                                  │
┌──────────────┐     REST/JSON      ┌─────────────▼───────────────┐
│  Mobile      │ ─────────────────► │  Route handlers /api/v1/*   │
│  (SQLite)    │ ◄──── delta sync ─ │  Server Actions             │
└──────────────┘                    └─────────────┬───────────────┘
                                                  │
                    ┌─────────────────────────────┼──────────────────────┐
                    │                             │                      │
            ┌───────▼───────┐            ┌────────▼────────┐    ┌────────▼────────┐
            │  PostgreSQL   │            │  Redis          │    │  Object Storage │
            │  RLS, data    │            │  sessions/cache │    │  PDFs/backups   │
            └───────────────┘            └─────────────────┘    └─────────────────┘
```

---

## 5. Frontend Architecture

### 5.1 Web (Next.js 16)

- **App Router** with Server Components by default; Client Components only where interactivity is required.
- **Data fetching** via Server Components and TanStack Query for client caches.
- **Mutations** via Server Actions for same-origin UX and REST handlers for mobile/external.
- **Forms** via React Hook Form + Zod (shared schemas).
- **State** split: server state (TanStack Query) vs. ephemeral UI state (Zustand).
- **Routing** uses parallel/intercepting routes for modals and deep links.

### 5.2 Mobile (Expo)

- **Expo Router** (typed routes, deep linking).
- **New Architecture only** (Fabric, TurboModules, JSI).
- **Local-first**: `expo-sqlite` for reads, an outbox table for writes.
- **Background sync** via `expo-task-manager` + `/api/v1/sync/delta`.
- **Secure storage** for tokens (`expo-secure-store`).

### 5.3 Desktop (Tauri/Electron)

- Reuses the web frontend bundle and `packages/shared`.
- Local SQLite for offline reads; outbox for writes; same sync protocol as mobile.
- Native capabilities: file system export, system print dialogs, global shortcuts, tray.
- Auto-update channel; signed installers; OS keychain for tokens.
- Prefer Tauri for smaller bundles and stronger security; Electron if native Node modules are required.

### 5.4 Shared Design System

- Tokens (color, spacing, type, radius, motion) in `packages/ui-tokens`, consumed by Tailwind (web) and NativeWind (mobile).
- Components built on Radix primitives (web) and platform primitives (mobile) with visual parity, not code sharing.
- Dark mode via CSS variables / native color schemes.
- Responsive breakpoints: mobile < 768, tablet 768–1024, desktop > 1024.

---

## 6. Backend & API Architecture

### 6.1 API Contract

- Base path `/api/v1/*`, JSON envelope `{ data, meta?, error? }`.
- Every response carries `X-Api-Version`, `X-Min-Client-Version`, `X-Recommended-Client-Version`.
- Breaking changes require a new major version; within a version changes are additive only.
- Deprecated versions served for 12 months with a `Sunset` header.
- Mobile sends `X-Client-Version` and `X-Client-Platform`.

### 6.2 Authentication

- Email/password (Argon2id) + optional OAuth.
- JWT access (15 min, RS256) + refresh (7 days, rotatable, server-side session row).
- TOTP 2FA required for `ADMIN` and `SUPER_ADMIN`.
- Revocation by deleting the session row.
- Web: httpOnly cookie; Mobile: `expo-secure-store`.

### 6.3 Request Scoping (R9/R10)

- A single `proxy.ts` (Next.js 16) verifies the JWT and injects `x-tenant-id`, `x-user-id`, `x-user-role`.
- `requireScope()` throws if any header is missing; repositories refuse to run without a scope.
- RLS is the authoritative guard; app filters are defence-in-depth.

### 6.5 Async Jobs & Queues

- Long-running work (PDF generation, exports, email/SMS, backups) runs in a background queue (Redis-backed) and never blocks a request.
- Jobs are idempotent and retryable with exponential backoff; failures surface in observability, not silently.
- Scheduled jobs: backups, sync reconciliation, report pre-computation, session cleanup.

---

## 7. Domain Model & Accounting Engine

### 7.1 Core Entities

```ts
Voucher {
  id, date, narration, voucherType, entries: JournalEntry[],
  totalDebit, totalCredit, status: 'draft' | 'posted' | 'reversed',
  version, idempotencyKey?, sequenceNumber?, reversedById?, tenantId
}

JournalEntry { accountId, accountType, debit, credit, reference? }

Account { id, name, code, type, parentId?, isGroup, openingBalance, tax*, tenantId }
```

Money is integer minor units everywhere; `number` in TS is only a transport convenience, never a calculation result.

### 7.2 Voucher Types

Payment, Receipt, Journal, Sales Invoice, Purchase Invoice, Debit Note, Credit Note, Contra, Refund, Transfer, Stock Transfer, Adjustment.

### 7.3 Accounting Invariants (R-rules)

| Rule | Invariant |
| --- | --- |
| R1 | Posted vouchers are immutable; reversal creates a linked reversal voucher. |
| R2 | A closed fiscal period refuses posts; only an explicit reopen (audited) allows them. |
| R3 | Sequence numbers are gapless and assigned at post via `SELECT … FOR UPDATE`. |
| R4 | Drafts are validated at create; posts re-validate totals and shape. |
| R5 | Optimistic concurrency via `version`; stale writes are rejected (`CONFLICT`). |
| R6 | Idempotency key is unique per tenant; retries return the original result. |
| R7 | Money is integer minor units; VAT uses millitaka precision; rounding routed to a dedicated account. |
| R8 | Posting is atomic: validate + sequence + write + idempotency in one transaction. |
| R9 | PostgreSQL RLS is authoritative for tenant isolation. |
| R10 | Repository layer requires an explicit tenant scope. |
| R11 | Argon2id password hashing. |
| R12 | TOTP 2FA (RFC 6238), required for admin roles. |
| R13 | Revocable, server-side refresh sessions. |
| R14 | Rate limits per tenant/IP/user. |
| R15 | Append-only audit log for every mutation. |
| R20 | Reversal requires a step-up (TOTP) token. |

---

## 8. Data Layer

- **PostgreSQL 16** with RLS on every tenant-scoped table.
- **Transaction isolation**: `READ COMMITTED` for reads, `SERIALIZABLE` (or `SELECT … FOR UPDATE`) for posting and sequence reservation.
- **Drizzle ORM** for type-safe queries; raw SQL only in migrations.
- **Migrations** are reviewed SQL files (up/down) and include RLS policy creation; forward-only in production.
- **Automated RLS assertion** runs in CI: every tenant-scoped table must have a policy.
- **Indexes** on `(tenant_id, …)` for hot paths (vouchers by date/type, journal lines by account); partial indexes for drafts.
- **Read replicas** for heavy reports; primary for writes.
- **Backups**: scheduled `pg_dump` + WAL archiving for PITR, AES-256 encrypted, restorable, tested quarterly.
- **Tenant-level export**: a tenant can export all data (JSON/CSV) for portability and offboarding.
- **Retention policy**: audit log and posted vouchers retained per legal requirements; soft-delete only for non-financial entities.

---

## 9. Offline & Synchronization (Mobile)

- Local SQLite schema mirrors the server subset needed for reads.
- Writes are recorded in an **outbox** with idempotency keys and retry metadata.
- Sync protocol: `GET /api/v1/sync/delta?since=<cursor>` returns changed aggregates; client applies and advances cursor.
- Conflicts: server wins for posted vouchers; drafts merge by `version` with user resolution UI.
- Partial sync is resumable; large payloads are chunked.
- Network state surfaced in UI; never block read-only screens.
- Biometric unlock (mobile) and OS keychain (desktop) for local data at rest.

---

## 10. UX Architecture (First-Class)

### 10.1 Information Architecture

Primary navigation is stable and shallow:

```
Dashboard → Vouchers → Invoices → Accounts → Reports → Bank → Settings
```

Each module has List → Detail → Edit, with deep links and breadcrumbs.

### 10.2 Interaction Principles

- **Keyboard-first**: every data-entry screen works without a mouse; `Tab` follows the grid, `Enter` advances, `Ctrl/Cmd+S` saves, `Esc` cancels.
- **One primary action per screen**; destructive actions are secondary and confirmed.
- **Optimistic UI** only where safe (drafts); posted data waits for server confirmation.
- **No silent failures**: every error shows a human message + the `ApiError.code` + a retry.
- **Undo-friendly drafts**: nothing auto-posts; reversal creates history rather than deleting.
- **Empty states explain why** and offer the next action.

### 10.2b Power-User UX

- **Command palette** (`Ctrl/Cmd+K`) for navigation, search, and actions.
- **Bulk operations** on lists (approve, export, tag) with progress and undo.
- **Saved views/filters** per user (date range, status, account).
- **Inline editing** in grids where safe; validation on blur.
- **Conflict resolution UI** for stale drafts (show both versions, merge).
- **Undo stack** for draft edits (not for posted data).
- **Global shortcuts** documented and discoverable (`?` to list).

### 10.3 Accessibility (WCAG 2.2 AA)

- Visible focus rings; no focus traps except modals (which trap correctly).
- ARIA labels on icon-only controls; form errors announced.
- Colour is never the only signal; contrast ≥ 4.5:1.
- Reduced-motion respected; all animations optional.
- Screen-reader tested on the top 5 flows.

### 10.4 Performance UX

- Skeletons for every async surface; no blank screens.
- Virtualized long lists (vouchers, ledger lines).
- Prefetch on hover/focus for likely next screens.
- Bundle budgets enforced in CI; code-split by route.

### 10.5 Localization (Bangladesh)

- ৳ symbol and South Asian grouping (lakh/crore) where appropriate.
- Dates default to DD/MM/YYYY; fiscal year 1 Jul – 30 Jun.
- NBR-compliant document layouts (Mushak forms).
- i18n-ready (bn/en) even if only English ships first.

---

## 11. Bangladesh Compliance

- **VAT**: 15% standard; reduced 5/7.5/10; zero-rated and exempt; ITC tracking; VDS and SD.
- **Mushak forms**: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10, 6.10A.
- **TDS**: section-wise (52, 52A, 52AA, 52B, 52BB, 53AA, 56) with rates; challan, IT-105, certificates.
- **e-BIN/e-TIN** printed and validated where applicable.
- **AIT** tracked per transaction type.
- Fiscal year default 1 Jul – 30 Jun, configurable.

---

## 12. Reporting & Documents

- Trial Balance, P&L, Balance Sheet, Cash Flow.
- VAT/TDS/VDS/SD summaries and Mushak 6.8.
- Ageing (receivables/payables).
- Bank statement and reconciliation status.
- Export: PDF (NBR layout), XLSX, CSV.
- Search: full-text (Postgres `tsvector`) over parties, invoices, and vouchers with tenant scoping.

---

## 13. Security

- Argon2id; RS256 JWT with `kid` rotation.
- TOTP 2FA for admin roles; step-up for destructive actions.
- Revocable refresh sessions; device trust list; rate limits; CORS allow-list.
- SQL injection prevented by parameterised ORM; XSS by React escaping + strict CSP.
- CSRF protection for cookie-based web sessions.
- Secrets in a vault/KMS; never in repo; rotation runbook.
- WAF/edge protection for public endpoints; bot and abuse detection.
- AES-256 for backups; audit log append-only with retention policy.

---

## 14. Observability

- Structured JSON logs with request/tenant/user correlation IDs.
- Metrics: latency, error rate, posting counts, sync lag, queue depth.
- Tracing across proxy → handler → DB.
- Audit log queryable per tenant and per user.
- Alerts on: failed postings, RLS violations, sync backlog, backup failures, SLO breach.
- SLOs with error budgets; runbooks for every alert.

---

## 15. Testing Strategy

| Layer | Scope | Tools |
| --- | --- | --- |
| Unit | Money, ledger engine, formatters | Vitest |
| Property | Accounting invariants (balance, rounding) | fast-check |
| Integration | Repositories against real Postgres + RLS | Vitest + Testcontainers |
| Contract | `/api/v1/*` vs shared Zod schemas | Vitest |
| E2E | Top user flows (web) | Playwright |
| Mobile | Components + sync logic | Jest + RNTL |
| Accessibility | Automated a11y on key screens + manual audit | axe, screen readers |
| Load | Posting/sync/report throughput | k6 |
| Chaos | Network drop, DB failover, partial sync | custom |

CI gates: typecheck, lint, tests, bundle budgets, migration dry-run, RLS assertion, accessibility.

---

## 16. CI/CD & Deployment

- **Web**: Vercel (or self-hosted container) with preview deployments per PR.
- **Mobile**: EAS Build/Submit, OTA updates for non-native changes.
- **Migrations**: run in a controlled step before deploy; backward-compatible first; tested on a copy of prod data.
- **Deployment**: blue/green for web; staged rollout for mobile/desktop.
- **Feature flags** for gradual rollout of risky accounting changes.
- **Rollback**: previous build + DB backup; restore drill documented and tested.

---

## 17. Non-Functional Requirements

- **Correctness**: zero unbalanced posted vouchers; RLS test green.
- **Availability**: 99.9% for web API.
- **Latency**: p95 < 300ms for reads, < 800ms for posts.
- **Data durability**: daily tested backups, RPO 24h, RTO 4h.
- **Offline**: mobile fully usable read-only without network; writes queue.

---

## 18. Roadmap

- **Phase 0** — Foundation: monorepo, shared package, DB + RLS, auth, proxy.
- **Phase 1** — Core accounting: COA, vouchers, posting, reports (TB/P&L/BS), invoices (Mushak 6.2).
- **Phase 2** — Compliance depth: all Mushak forms, TDS, VDS, SD, bank reconciliation.
- **Phase 3** — Mobile offline + sync, payments, notifications.
- **Phase 4** — Inventory, multi-currency, advanced reporting, analytics.

---

## 19. Caching Strategy

- **HTTP**: `ETag`/`Last-Modified` on GETs; `stale-while-revalidate` for lists.
- **Server**: Redis cache for hot aggregates (dashboard KPIs, COA) with tenant-scoped keys and explicit invalidation on post.
- **Client**: TanStack Query with per-tenant query keys; optimistic updates only for drafts.
- **Reports**: pre-compute heavy reports in background jobs; cache with versioned keys.
- **Never cache** posted voucher detail or tenant-scoped sensitive data in shared caches.

---

## 20. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Concurrent posts corrupt balances | Serializable isolation + row locks + idempotency keys |
| Tenant data leak | RLS authoritative + CI assertion + scoped repos |
| Offline sync conflicts | Server-authoritative posted data + versioned drafts + conflict UI |
| Rounding errors | Integer minor units + millitaka precision + dedicated rounding account |
| Migration breaks prod | Backward-compatible migrations + dry-run on prod copy + rollback |
| Lost backups | PITR + quarterly restore drills + off-site copy |

---

## 21. Data Import & Migration

- Import from Tally/Excel/CSV with a staging table and validation report.
- Dry-run mode shows errors before commit; rollback on failure.
- Tenant onboarding wizard: COA template selection, fiscal year, tax settings.
- Idempotent import keys prevent duplicate runs.

---

## 22. Threat Model (Summary)

- Assets: tenant financial data, credentials, audit logs.
- Threats: cross-tenant access, privilege escalation, injection, token theft, data exfiltration.
- Controls: RLS, scoped repos, Argon2id, RS256 rotation, CSP, WAF, audit log, anomaly alerts.

---

## 23. Cost & Scaling

- Start single-region; scale read replicas and cache before sharding.
- Per-tenant resource limits and rate limits.
- Background jobs absorb heavy work; keep request path lean.
- Monitor cost per tenant; optimize hot queries and indexes.

---

## 24. Decision Log (ADRs)

Every significant choice (ORM, auth, offline strategy, money representation) is recorded as an ADR in `docs/adr/` with context, decision, and consequences. New contributors read these before proposing changes.

