# NeuroBook

Multi-platform accounting platform (Tally Prime alternative) for Bangladesh — Next.js 16 (web) + React Native via Expo (mobile) from a monorepo.

See [Architecture.md](Architecture.md) for the full architecture.

## Workspaces

- `apps/web` — Next.js 16 (App Router, Server Actions, REST `/api/v1/*`)
- `apps/mobile` — Expo (React Native, New Architecture, Expo Router)
- `packages/shared` — pure-JS ledger engine, Zod schemas, money, auth primitives, BD formatters

## Quick start

```bash
# 1. Local infra
docker compose up -d

# 2. Install
npm install

# 3. Env
cp .env.example .env

# 4. Database: push schema, enable RLS, seed demo data
npm run db:setup --workspace=@neurobook/web

# 5. Develop
npm run dev          # web (and mobile if configured)
```

## Roles

| Role | Scope |
| --- | --- |
| `ADMIN` | Everything, including users, settings, and period closing |
| `MANAGER` | Everything except user management |
| `ACCOUNTANT` | Vouchers, invoices, masters, bank, tax, audit |
| `SALES` | Sales invoices, receipts, customers |
| `PURCHASER` | Purchases, payments, suppliers, stock |
| `CASHIER` | Receipts, payments, bank |
| `STORE_KEEPER` | Products and stock |
| `AUDITOR` | Read-only plus audit log |
| `VIEWER` | Read-only |

Authorization is defined once in `packages/shared/src/auth.ts` and enforced by `proxy.ts` plus per-route checks. Tenant isolation uses both application scoping and PostgreSQL RLS (`app.tenant_id` set per transaction).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev servers via Turborepo |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | TypeScript across workspaces |
| `npm run test` | Tests across workspaces |
| `npm run db:setup --workspace=@neurobook/web` | Push schema, enable RLS, seed |
| `npm run db:rls --workspace=@neurobook/web` | Create app role and RLS policies |
| `npm run db:seed --workspace=@neurobook/web` | Seed demo data |

## Layout

```
.
├── apps/
│   ├── web/          # Next.js 16
│   └── mobile/       # Expo
├── packages/
│   └── shared/       # ledger, auth, money, format
├── docs/             # ADRs, runbooks
├── migrations/       # SQL migrations
├── Architecture.md
└── docker-compose.yml
```
