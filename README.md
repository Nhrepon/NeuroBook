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

A user is one row per tenant, so the same email can belong to several companies. Every company also has exactly **one company password** (`tenants.password_hash`) — one company, one password — which is what the dashboard switcher asks for, not the person's login password. Every user who switches into that company types the same one, so a change applies to all of them at once. `POST /api/v1/auth/switch` moves the session to another company; switching requires the `tenant:switch` permission (ADMIN and MANAGER) and the target company's password. A company with no password yet returns `TENANT_PASSWORD_REQUIRED`.

Only ADMIN (`tenant:manage`) may change a company password, and only for a company its email belongs to. A company whose email has no membership row is a 404 to that admin, exactly as if it did not exist — there is no cross-tenant operator access any more.

- `PATCH /api/v1/tenants` with `{ id, password }` — from the dashboard **Companies** page (`/dashboard/companies`), which lists the companies this admin belongs to, with user counts, whether a password is set, a *Change password* action, a *Switch* action and a *Delete* action. The current password is not required, so a lost one can be replaced.
- `PATCH /api/v1/settings` with `{ currentPassword, newPassword }` — for the company the session is already in, where the current password **is** required (the first set bootstraps a company that has none).

Both audit `tenant.password_change`. Users already switched in keep the session until their 15-minute token expires.

`GET /api/v1/auth/tenants` lists what the switcher offers — exactly the companies where the signed-in email has an active membership row. There is no admin shortcut to a company it does not belong to:

- MANAGER and ADMIN get the companies their email belongs to, with the role assigned there.
- A company is entered by its company password; the visiting session carries the membership's role. `auth.tenant_switch` is audited with `as: "member"`.

**The company name lives on `tenants.name`** and is what the sidebar badge, the switcher, login and `/auth/me` read. Settings writes both `tenants.name` and `company_settings.company_name` (the latter is what invoices and the PDF print), and audits the rename as `tenant.rename`. `npm run db:sync-names` repairs rows written before this rule existed.

Admins manage company users from Users &amp; roles: role, enable/disable, move to another company (`PATCH /api/v1/users` with `tenantId`), and remove.

`POST /api/v1/tenants` (ADMIN) creates a company: name, company code (derived from the name when omitted) and a **required** company password. The creator is added as the company's first **ADMIN** member (`join`, default true), so it can open the company immediately and staff it — the same rule as registration. It seeds the company profile and the default chart of accounts; the dashboard **New company** button opens the same form. A company with no password could never be entered by anyone, which is why one is required here.

`DELETE /api/v1/tenants?id=` (ADMIN) deletes a company **and all of its data** — every tenant-scoped table cascades from `tenants(id)`, so accounts, vouchers, journal lines, invoices, payments, parties, products, stock, users, settings and that company's audit log all go in one statement. Two places expose it, both asking you to type the company code before the button arms: the dashboard **Companies** page, and the **Danger zone** at the bottom of **Settings** (`canManageCompany`) for the company the session is in. It refuses when the company is the only one your email belongs to (you would be locked out), and deleting the company your session is in ends that session — the cookie is cleared and the browser lands on `/login?deleted=1`, which explains what happened. The deletion is audited as `tenant.delete` under a company you still belong to.

`npm run db:multi-tenant` seeds a local fixture for this: `admin@demo.com` ends up in both `demo` and `demo-two` (company password `password123` in each), so its sign-in now needs a company code.

### Audit trail

`GET /api/v1/audit` returns the newest 500 events for the company the session is in, and `proxy.ts` stamps every request with `x-audit-route` plus the resolved user/role so each row can answer *who / what / where* without every route having to pass any of it:

| Field | Meaning |
| --- | --- |
| `user_id` + joined email, `actor_role` | Who did it, and the role it held **at the time** (a snapshot — a later role change does not rewrite history). `user_id` is `SET NULL` if the user is later removed, so old rows may name nobody. |
| `action`, `resource_type`, `resource_id` | What was touched (`voucher.post`, `tenant.delete`, ...). |
| `before` / `after` | Field-level detail; the console renders it as `role: SALES → MANAGER`. |
| `ip`, `user_agent`, `route` | Where it came from: client IP (`x-forwarded-for` first hop), the browser / device, and the endpoint that handled it (`POST /api/v1/vouchers`). |

The dashboard **Audit log** (`/dashboard/audit`, `audit:read`) shows those columns and expands a row into the full before/after table, the actor's user id, the company, the raw user-agent string, the endpoint and the event id. Rows written before these columns existed simply show `not captured`.

### Session revocation

Every token carries a `ver` claim — the user row's `token_version` at sign-in. `proxy.ts` re-reads that row on every request and rejects the request (`SESSION_REVOKED`, 401 for APIs; `/login?expired=1` for pages) when the user is gone, inactive, no longer belongs to the company the token names, or its `token_version` no longer matches. The role is taken from the row, not the token, so a demotion takes effect at once.

`PATCH /api/v1/users` bumps `token_version` (and therefore kills every live token for that account) when the role changes, the account is activated or deactivated, the password is reset, or the membership is moved to another company. Company-password rotation and logout do **not** bump — sessions keep working until their 15-minute expiry.

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
