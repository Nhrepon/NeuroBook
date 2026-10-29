# NeuroBook

Multi-company accounting for Bangladesh — a Tally Prime alternative built as a
Next.js 16 web app plus an Expo mobile app, sharing one TypeScript ledger engine.

See [Architecture.md](Architecture.md) for the design and [MIGRATION.md](MIGRATION.md)
for the monorepo history.

## Workspaces

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 App Router, REST `/api/v1/*`, PostgreSQL + Drizzle |
| `apps/mobile` | Expo / React Native client |
| `packages/shared` | Ledger engine, money, Zod schemas, roles/permissions, BD formatters |

## What it does

- **Vouchers** — double-entry drafts that post with gapless `TYPE/FY 2026-27/000001`
  numbering, then lock. Posted vouchers are reversed, never edited. Keyboard-driven
  entry with starter ledgers per voucher type.
- **Sales & purchase invoices** — itemised lines, VAT, Mushak 6.2 PDF, due dates and
  posting to a voucher. Posted bills can be settled (partially or fully paid) and the
  invoice status follows the money.
- **Receipts & payments** — dedicated money-in / money-out forms. Choose cash/bank/mobile,
  an optional supplier/customer, or a specific unpaid bill to settle it in one step.
- **Products** — automatic (`P-0001`) or custom item codes, SKUs/barcodes, sale and cost
  price with margin, reorder level, active/inactive. Products with any stock or invoice
  history cannot be deleted; deactivate them instead.
- **Product categories** — optional hierarchy (`Pacemaker → Single chamber`), code,
  description and active flag. Names are unique per company, ignoring case.
- **Stock** — a single movement ledger (`in`, `out`, `transfer`, `adjustment`) drives
  on-hand quantities, valuation, low-stock flags and per-item history.
- **Bank** — bank accounts, transactions and a dashboard balance.
- **Tax rates** — VAT/AIT/VDS/customs definitions live in Settings and are seeded per
  company; invoices keep the rate they were raised with.
- **Reports & dashboard** — trial balance, profit & loss, balance sheet, receivables/
  payables, cash position and recent activity.
- **Audit trail** — append-only, with actor, role snapshot, IP, device and endpoint.

## Quick start

Requires Node 20+, npm 10+, and Docker (for PostgreSQL).

```bash
# 1. Infrastructure (Postgres 16 on :5432)
docker compose up -d postgres

# 2. Install workspaces
npm install

# 3. Environment for the web app
cp .env.example apps/web/.env      # Windows: Copy-Item .env.example apps/web/.env

# 4. Fresh database: push schema, create the app role + RLS, seed demo data
npm run db:setup

# 5. Develop
npm run dev
```

Open <http://localhost:3000>.

Demo company: **`demo`** · **admin@demo.com** · **password123**
Other seeded roles use the same password (`manager@demo.com`, `accountant@demo.com`,
`sales@demo.com`, `purchaser@demo.com`, `cashier@demo.com`, `store@demo.com`,
`auditor@demo.com`, `viewer@demo.com`).

> After `npm run db:multi-tenant`, `admin@demo.com` also belongs to `demo-two`, so
> sign-in needs the company code (`demo` or `demo-two`).

## Environment

Next.js loads `apps/web/.env` automatically. The `db:*` scripts read the **process
environment** (they do not load that file); their built-in defaults match
`docker-compose.yml`, so local use needs no environment file at all. If you point at a
different database, export the variables in your shell before running a script.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Owner connection: migrations, seeding, auth lookup |
| `APP_DATABASE_URL` | Restricted runtime role; **RLS is enforced for this role** |
| `APP_DB_ROLE` / `APP_DB_PASSWORD` | Optional overrides used by `db:rls` |
| `JWT_SECRET` | 32+ character signing secret (dev default only) |
| `EXPO_PUBLIC_API_URL` | Mobile app's API base URL |

`db:rls` creates the app role and its grants. Every tenant table has an
`app.tenant_id` policy, set per transaction by `withTenant()`.

## Database scripts

| Script | What it does |
| --- | --- |
| `npm run db:setup` | `drizzle-kit push --force` → `db:rls` → `db:seed` (fresh DB) |
| `npm run db:rls` | Create the app role, enable RLS, install the tenant-code trigger |
| `npm run db:seed` | Demo company, users, chart of accounts and default tax rates |
| `npm run db:chart` | Backfill missing default ledgers **and** tax rates |
| `npm run db:stock` | Backfill stock movements from already-posted invoices |
| `npm run db:product-codes` | Assign `P-0001` codes to products that have none |
| `npm run db:multi-tenant` | Add `demo-two` for multi-company testing (`-- --remove` to undo) |
| `npm run db:sync-names` | Repair `tenants.name` from `company_settings.company_name` |
| `npm run db:studio` | Open Drizzle Studio |

### Upgrading an existing database

`drizzle-kit push` cannot add `tenants.code` (NOT NULL, no default) to a table that
already has rows, and it does not rewrite existing `CHECK` constraints. On an older
database: backfill `upper(slug)` into `tenants.code`, push, then run `db:rls`,
`db:chart`, `db:stock` and `db:product-codes`. Fresh installs need only `db:setup`.

## Companies, users and security

- **One row per user per company.** The same email can be a member of several
  companies with a different role in each. There is no global user record.
- **One company password per company** (`tenants.password_hash`), shared by everyone
  who switches in. It is what the dashboard switcher asks for, not the person's login
  password. Rotating it never invalidates existing sessions.
- **Company code** (`tenants.code`) is derived from the slug in uppercase, is globally
  unique, and is **immutable** — a database trigger rejects any change. Sign-in accepts
  it case-insensitively. The slug remains the URL/company key.
- **Company status** is `active`, `suspended` or `archived`. Only active companies can
  be entered; suspending cuts live sessions on their next request.
- **Switching** (`POST /api/v1/auth/switch`) requires the target company's password and
  an active membership row; ADMIN/MANAGER only.
- **Self-service account deletion** at `/dashboard/account` (`DELETE /api/v1/auth/account`)
  removes only the current company membership and ends the session. The last active
  admin of a company cannot delete themselves.
- **Company deletion** (`DELETE /api/v1/tenants?id=`) cascades every tenant-scoped table.
  It works even for the admin's only company; the session ends and the browser returns
  to `/login?deleted=1`. The audit entry is written under another company the admin
  belongs to, when one exists.
- **Session revocation.** Tokens carry the user's `token_version`; the proxy re-checks
  the user on every request. Role changes, deactivation, password resets and moves bump
  the version and kill live tokens at once.
- **Audit log** is append-only: the app role has `INSERT`/`SELECT` but no `UPDATE`/
  `DELETE`. Secrets and password hashes are redacted before storage.

### Roles

| Role | Scope |
| --- | --- |
| `ADMIN` | Everything, including users, companies and period closing |
| `MANAGER` | Everything except user and company administration |
| `ACCOUNTANT` | Vouchers, invoices, masters, bank, tax, audit |
| `SALES` | Sales invoices, receipts, customers |
| `PURCHASER` | Purchases, payments, suppliers, stock |
| `CASHIER` | Receipts, payments, bank |
| `STORE_KEEPER` | Products and stock |
| `AUDITOR` | Read-only plus the audit log |
| `VIEWER` | Read-only |

Authorization is defined once in `packages/shared/src/auth.ts`; the proxy gates API
mutations and admin pages, and controllers re-check sensitive actions.

## Accounting model

- **Money** is stored as integer minor units in `bigint` (taka × 100); quantities are
  `numeric(18,4)`; accounting dates are `date`, while created/posted stamps are
  `timestamptz`.
- **Vouchers** move `draft → posted`; posting assigns the fiscal-year sequence and
  journal lines, and a posted voucher can only be reversed. Fiscal year runs July–June.
- **Voucher shape rules** are enforced on posting: a receipt debits an asset, a payment
  credits an asset, contra/transfer use assets only, sales invoices debit a receivable
  and credit revenue, purchases debit an expense and credit a payable.
- **Invoices** derive their totals from lines. Posting creates the journal voucher;
  settling a bill posts a receipt/payment voucher, links it in `payments`, and updates
  the invoice (`partially_paid` / `paid`). Deleting a settlement reverses its voucher and
  recalculates the bill.
- **Stock** is the `stock_movements` ledger. Posting a purchase adds `in`, a sale adds
  `out`; manual adjustments carry a sign; transfers net to zero company-wide.
- **Products** are guarded: an item with stock movements or invoice lines cannot be
  deleted, so history never loses its product.

## API surface

All product routes are under `/api/v1` and return `{ data }` or `{ error: { code, message } }`.
Health probes live outside it: `GET /api/health`, `GET /api/ready`.

| Area | Endpoints |
| --- | --- |
| Auth | `auth/login`, `auth/register`, `auth/logout`, `auth/me`, `auth/switch`, `auth/tenants`, `auth/account` |
| Companies | `tenants` (GET/POST/PATCH/DELETE) |
| Settings | `settings` (GET/POST/PATCH) |
| Masters | `accounts`, `categories`, `products`, `product-skus`, `parties`, `tax/rates`, `bank/accounts`, `bank/transactions` |
| Vouchers | `vouchers`, `vouchers/:id`, `vouchers/:id/post`, `vouchers/:id/reverse` |
| Invoices | `invoices`, `invoices/:id`, `invoices/:id/post`, `invoices/:id/pdf` |
| Settlements | `payments`, `payments/:id` |
| Stock | `stock`, `stock/:id` |
| Other | `periods`, `dashboard`, `reports/:type` (`trial-balance`, `profit-loss`, `balance-sheet`), `users`, `audit` |

## Verification

```bash
npm run typecheck   # TypeScript across all workspaces
npm run test        # workspace tests
npm run build       # production build
```

## Layout

```
.
├── apps/
│   ├── web/          # Next.js 16 (App Router, API routes, UI kit)
│   └── mobile/       # Expo
├── packages/
│   └── shared/       # ledger, auth, money, format, Zod
├── docs/             # ADRs and runbooks
├── migrations/       # SQL migrations
├── Architecture.md   # system design
├── MIGRATION.md      # monorepo migration notes
└── docker-compose.yml
```