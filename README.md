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

A user is one row per tenant, so the same email can belong to several companies. Every company also has its own **company password** (`tenants.password_hash`), which is what the dashboard switcher asks for — not the person's login password. `POST /api/v1/auth/switch` moves the session to another company; switching requires the `tenant:switch` permission (ADMIN and MANAGER) and the target company's password. A company with no password yet returns `TENANT_PASSWORD_REQUIRED` until an ADMIN sets one in Settings (`tenant:manage`).

`GET /api/v1/auth/tenants` lists what the switcher offers:

- MANAGER gets the companies its email belongs to.
- ADMIN also gets **every other company on the server**, marked `member: false`. Entering one still needs that company's password and does not create a membership row; the visiting session carries the ADMIN role, so it has full access to that company and every action is audited under the same user id (`auth.tenant_switch` with `as: "admin"`). The dashboard shows an **Admin access** chip while visiting.

**The company name lives on `tenants.name`** and is what the sidebar badge, the switcher, login and `/auth/me` read. Settings writes both `tenants.name` and `company_settings.company_name` (the latter is what invoices and the PDF print), and audits the rename as `tenant.rename`. `npm run db:sync-names` repairs rows written before this rule existed.

Admins manage company users from Users &amp; roles: role, enable/disable, move to another company (`PATCH /api/v1/users` with `tenantId`), and remove.

`npm run db:multi-tenant` seeds a local fixture for this: `admin@demo.com` ends up in both `demo` and `demo-two` (company password `password123` in each), so its sign-in now needs a company code.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev servers via Turborepo |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | TypeScript across workspaces |
| `npm run test` | Tests across workspaces |
| `npm run db:setup` | Push schema, enable RLS, seed |
| `npm run db:rls` | Create app role and RLS policies |
| `npm run db:seed` | Seed demo data |
| `npm run db:chart` | Backfill the default chart of accounts |
| `npm run db:multi-tenant` | Give `admin@demo.com` a second company (`demo-two`) for multi-tenant testing; add `-- --remove` to undo |
| `npm run db:sync-names` | Repair `tenants.name` from `company_settings.company_name` (add `-- --report` to preview) |
| `npm run db:studio` | Open Drizzle Studio on https://local.drizzle.studio |

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
