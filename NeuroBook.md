# NeuroBook — Accounting Platform Architecture (Tally Prime Alternative)

## 1. Overview

NeuroBook is a multi-platform accounting application inspired by Tally Prime. It provides
invoicing, ledger management, VAT/Tax compliance, bank reconciliation, financial reporting, Inventory Management
and multi-tenancy — across three platforms from a single codebase:

| Platform | Technology               | Target                                |
| -------- | ------------------------ | ------------------------------------- |
| Web      | Next.js 16 (App Router) | Browser — SaaS / hosted               |
| Desktop  | Electron                 | Windows, macOS, Linux (offline-first) |
| Mobile   | React Native             | iOS, Android (offline-first)          |

---

## 2. Monorepo Structure

```
neurobook/
├── apps/
│   ├── web/                  # Next.js 16 (App Router) — the whole backend lives here
│   │   ├── src/
│   │   │   ├── app/          # routes, app/api/v1/*/route.ts, server actions
│   │   │   ├── db/           # Drizzle schema, client, migrations, postVoucher repo
│   │   │   └── middleware.ts # auth verification + tenant scope (R9/R10)
│   │   └── drizzle.config.ts
│   └── mobile/               # React Native (Expo) — imports packages/shared only,
│                             # talks to apps/web over REST with a JWT Bearer token
├── packages/
│   └── shared/               # The one shared boundary. Pure JS, no framework:
│                             # types, Zod schemas, integer money, the ledger
│                             # engine, BD formatters, auth primitives
├── NeuroBook.md              # This file
├── package.json              # Root workspace config (npm workspaces)
├── vitest.config.ts          # Resolves the app's `@/` alias for tests
└── docker-compose.yml        # Local dev infrastructure
```

**Why one package.** Everything except `shared` is something Next.js already
gives you, so a package for it buys indirection and costs a build step. Auth is
`middleware.ts`, mutations are server actions, REST is `app/api/*/route.ts`, env
validation is `next.config.ts`, and Drizzle lives in the app because only the app
talks to Postgres. `shared` stays a package for one reason: Expo imports it for
validation and formatting, and `next/*` cannot be imported into React Native.

---

## 3. Technology Stack

### 3.1 Web (Next.js)

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (client) + React Query (server cache)
- **Forms**: React Hook Form + Zod validation (Server Actions for mutations)
- **RPC**: tRPC v11 (mounted on Next.js Route Handler — type-safe, no codegen)
- **Charts**: Recharts or Chart.js
- **PDF generation**: @react-pdf/renderer or jsPDF
- **Auth**: credentials + OAuth, implemented in `packages/shared` — no NextAuth
  dependency. `middleware.ts` verifies the RS256 token and sets the tenant scope;
  the refresh token is a revocable server-side row (§15.2 R13)

### 3.2 Desktop (Electron)

- **Shell**: Electron 30+ (main + renderer)
- **Renderer**: Next.js custom server (same `apps/web` codebase, runs locally inside Electron)
- **Native APIs**: `electron-store` (config), `node-notifier` (alerts),
  `child_process` (backup/restore), `fs` (file I/O)
- **Auto-update**: electron-updater
- **Packaging**: electron-builder (NSIS for Windows, DMG for macOS, AppImage for Linux)

### 3.3 Mobile (React Native)

- **Framework**: React Native via Expo (SDK)
- **Navigation**: Expo Router (file-based) + React Navigation
- **State**: Zustand + React Query
- **Storage**: AsyncStorage + SQLite (expo-sqlite) for offline
- **PDF**: react-native-pdf-lib
- **Camera/Scan**: expo-camera + ML Kit (OCR for receipts)
- **Push notifications**: Expo Notifications
- **Auth**: same JWT flow as web

### 3.4 What Is Shared, and What Is Not

There is exactly one shared package. Everything else lives in `apps/web`,
because Next.js already provides it (§2).

- **`packages/shared`** — pure JS, no framework, imported by both the web app
  and Expo:
  - Zod schemas, enums, constants (account types, tax rates, BD tax sections, Mushak form types)
  - Integer minor-unit money and the rounding policy (§15.1 R7)
  - The ledger engine — double-entry validation, reversal, trial balance, P&L, balance sheet
  - BD compliance helpers — lakh/crore and `dd/mm/yy` formatters, BD fiscal year utils
  - Auth primitives — JWT sign/verify, TOTP, Argon2id, rate limiting
- **In `apps/web`, not a package** — Drizzle schema and the post repository
  (`src/db`), tRPC router and REST route handlers (`src/server`), the component
  library (`src/ui`). Only the app talks to Postgres, so the ORM belongs to it.

### 3.5 Database & Infrastructure

- **Primary DB**: PostgreSQL / sqlite (self-hosted)
- **Offline DB**: SQLite (via better-sqlite3 for Electron, expo-sqlite for RN)
- **Cache**: Redis (sessions, rate limiting)
- **File storage**: S3-compatible object storage (MinIO locally, S3 in prod)
- **Queue**: BullMQ (background jobs — reconciliation, PDF generation, email)
- **Search**: SQLite FTS5 or Meilisearch (invoice search)

---

## 4. Core Accounting Engine (Shared `ledger/` package)

### 4.1 Double-Entry Bookkeeping

```
Transaction {
  id: string
  date: Date
  narration: string
  entries: JournalEntry[]   // at least 2 entries (debit + credit)
  totalDebit: int           // minor units; must equal totalCredit at post
  totalCredit: int
  status: 'draft' | 'posted' | 'reversed'
  version: int              // optimistic concurrency (§15.1 R5)
  idempotencyKey?: string   // safe retry (§15.1 R6)
  sequenceNumber?: string   // gapless legal numbering, assigned at post (§15.1 R3)
  reversedById?: string     // link to the reversal voucher, if reversed
}

// Money is integer minor units (taka × 100) — never float/double. See §15.1 R7.

JournalEntry {
  accountId: string
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  debit: int                // minor units, non-negative
  credit: int               // minor units, non-negative
  reference: string         // invoice, bill, payment reference
}
```

### 4.2 Account Hierarchy

```
ChartOfAccounts {
  root: AccountGroup[]
}

AccountGroup {
  id: string
  name: string             // e.g., "Current Assets"
  accounts: Account[]
}

Account {
  id: string
  name: string             // e.g., "Sundry Debtors"
  code: string             // e.g., "1200"
  type: AccountType
  parentId?: string
  isGroup: boolean
  openingBalance: number
  taxApplicable: boolean
  taxCategory?: string
  taxRate?: number
  taxExempt?: boolean
  taxDeductible?: boolean
  taxDeductibleRate?: number
  taxExemptRate?: number
  taxExemptReason?: string
  taxDeductibleReason?: string

}
```

### 4.3 Key Calculations

- **Trial Balance**: Sum all debits = Sum all credits (validation)
- **Profit & Loss**: Revenue - Expenses for a period
- **Balance Sheet**: Assets = Liabilities + Equity
- **Cash Flow**: Operating / Investing / Financing activities
- **VAT/TDS Reports**: Input tax credit, output tax liability, input tax liability and output tax credit
- **Reconciliation**: Bank statement matching (auto + manual)

---

## 5. Feature Modules

### 5.1 Multi-Tenancy

- Each organisation is a tenant with isolated data. PostgreSQL RLS is the
  authoritative enforcement; the app-layer `tenant_id` filter is
  defence-in-depth, never the sole guard (§15.2 R9)
- Schema: `tenant_id` on every table, with an automated test asserting an RLS
  policy exists on each one
- Auth middleware resolves tenant from the verified JWT and threads it through
  the request scope; unscoped queries are blocked at the repository layer (§15.2 R10)

### 5.2 User & Roles

```
Role: SUPER_ADMIN | ADMIN | ACCOUNTANT | MANAGER | STAFF | SALES | Auditor | USER | GUEST | VIEWER

Permissions (RBAC):
  - company.create, company.manage
  - voucher.create, voucher.edit, voucher.delete, voucher.approve
  - voucher.post, voucher.reverse
  - report.view, report.export, report.download
  - settings.manage, user.manage, role.manage
  - invoice.create, invoice.send, invoice.delete
  - customer.create, customer.edit, customer.delete
  - supplier.create, supplier.edit, supplier.delete
  - product.create, product.edit, product.delete
  - tax.create, tax.edit, tax.delete
  - user.create, user.edit, user.delete
  - role.create, role.edit, role.delete
  - backup.create, backup.restore
```

### 5.3 Voucher / Transaction Types

| Type             | Description                          |
| ---------------- | ------------------------------------ |
| Payment          | Cash/Bank payment to a party         |
| Receipt          | Cash/Bank receipt from a party       |
| Journal          | Manual journal entry                 |
| Sales Invoice    | Customer invoice (with VAT / TDS)    |
| Purchase Invoice | Supplier bill (with VAT / TDS)       |
| Debit Note       | Customer debit note                  |
| Credit Note      | Supplier credit note                 |
| Contra           | Bank-to-bank / cash-to-bank transfer |
| Refund           | Refund to customer/supplier          |
| Transfer         | Cash/Bank transfer between accounts  |
| Stock Transfer   | Transfer between warehouses          |
| Adjustment       | Manual adjustment of ledger balance  |

### 5.4 Invoice & Billing

- Create/send invoices with Mushak 6.2-compliant PDF layout
- Recurring invoices
- Payment tracking (partial, full, overdue)
- e-BIN + e-TIN printed on invoices (NBR requirement)
- SMS/email notification (via local SMS gateway + SendGrid)
- **Payment collection (Bangladesh)**:
  - SSLCommerz (most common BD gateway)
  - ShurjoPay (NBR-linked)
  - AamarPay
  - bKash (MFS — B2C)
  - Nagad (govt-backed MFS)
  - Rocket / DBBL (mobile banking)

### 5.5 VAT, VDS, SD & TDS Compliance (Bangladesh — NBR)

#### VAT (Value Added Tax)

- Standard rate: 15%; reduced rates: 5%, 7.5%, 10%; zero-rated; exempt
- Auto-calculation of output VAT (sales) and input VAT (purchases)
- Input tax credit (ITC) tracking
- **VAT Deducted at Source (VDS)** — mandatory for B2B service purchases
- **Supplementary Duty (SD)** — compounded on top of VAT for applicable goods/services
- Monthly **Mushak 6.8** return (auto-populated from ledger)

#### Mushak Forms (NBR-format PDF generation)

| Form         | Purpose                              |
| ------------ | ------------------------------------ |
| Mushak 6.1   | Purchase register (input book)       |
| Mushak 6.2   | Tax invoice (standard sales invoice) |
| Mushak 6.3   | Credit note — supplier               |
| Mushak 6.4   | Debit note — supplier                |
| Mushak 6.5   | Credit note — buyer                  |
| Mushak 6.6   | Return register                      |
| Mushak 6.7   | Price declaration                    |
| Mushak 6.8   | Monthly VAT return                   |
| Mushak 6.10  | Accounts & records register          |
| Mushak 6.10A | Purchase book (detailed)             |

#### TDS (Tax Deducted at Source — Income Tax Ordinance)

- Section-wise TDS deduction (not flat-rate):

| ITO Section | Applicable On                 | Rate    |
| ----------- | ----------------------------- | ------- |
| 52          | Contractor / supplier payment | 5%–7%   |
| 52A         | Royalties, technical fees     | 10%–12% |
| 52AA        | Commission, fee for services  | 10%     |
| 52B         | Interest on securities        | 5%      |
| 52BB        | Bank interest                 | 10%     |
| 53AA        | Commission / discount         | 10%     |
| 56          | Any other income (residual)   | 10%     |

- TDS challan (Treasury Challan) generation
- Monthly TDS return (IT-105) PDF
- TDS certificate for suppliers

#### Other Compliance

- **e-BIN validation**: verify VAT registration number against NBR API before printing
- **e-TIN display**: show TIN on all invoices above threshold
- **Advance Income Tax (AIT)**: tracked per import/transaction type
- **NBR fiscal year**: 1 July – 30 June (default; configurable)

### 5.6 Bank Reconciliation

- Import bank statement (CSV, OFX, QIF, etc.)
- Auto-match transactions by amount + date
- Manual match/unmatch
- Reconciliation status per account

### 5.7 Reporting

- Trial Balance
- Profit & Loss (P&L) — fiscal year 1 Jul – 30 Jun
- Balance Sheet — BFRS-compliant layout
- Cash Flow Statement
- VAT Summary Report (monthly / quarterly)
- TDS Summary Report (section-wise)
- VDS Report (deducted at source)
- SD (Supplementary Duty) Report
- Mushak 6.8 Monthly VAT Return (printable NBR format)
- TDS Return — IT-105
- Ageing Report (receivables / payables)
- Bank Statement
- Lakh / Crore number formatting (South Asian system)
- All amounts in ৳ (Taka symbol)
- Export: PDF (NBR-format where applicable), Excel (XLSX), CSV

### 5.8 Backup & Restore

- Full DB dump (PostgreSQL pg_dump / SQLite .dump)
- Encrypted backup files
- Restore from file or cloud storage
- Auto-backup schedule (cron via BullMQ)

### 5.9 Multi-Currency (Phase 2)

- Exchange rate API integration
- Transaction in foreign currency
- Gain/loss on conversion
- Currency conversion reports

### 5.10 Inventory / Stock (Phase 2)

- Product master
- Warehouses
- Inventory tracking
- Stock-in / stock-out tracking
- Low-stock alerts
- Inventory valuation (FIFO / weighted average)

---

## 6. API Architecture

### 6.1 API Layer — Full Next.js

All API logic lives inside `apps/web` (Next.js). No separate server required.

```
apps/web/
├── app/
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts      → tRPC endpoint (web + desktop client)
│   │   ├── v1/
│   │   │   ├── auth/route.ts         → login, register, refresh, logout
│   │   │   ├── companies/route.ts    → CRUD tenants
│   │   │   ├── accounts/route.ts     → chart of accounts CRUD
│   │   │   ├── vouchers/route.ts     → transaction CRUD
│   │   │   ├── invoices/route.ts     → invoice CRUD + PDF
│   │   │   ├── reports/route.ts      → P&L, balance sheet, trial balance, cash flow
│   │   │   ├── tax/route.ts          → VAT/TDS, e-invoice, Mushak
│   │   │   ├── customers/route.ts    → customer CRUD
│   │   │   ├── suppliers/route.ts    → supplier CRUD
│   │   │   ├── products/route.ts     → product CRUD
│   │   │   ├── users/route.ts        → user CRUD
│   │   │   ├── bank/route.ts         → reconciliation
│   │   │   ├── backup/route.ts       → create, list, restore
│   │   │   ├── settings/route.ts     → company settings, user prefs
│   │   │   └── webhooks/route.ts     → payment gateway callbacks
│   └── actions/                      → Server Actions (web form mutations)
│       ├── voucher.actions.ts
│       ├── invoice.actions.ts
│       └── report.actions.ts
└── middleware.ts                      → auth, tenant resolution, rate limiting

packages/shared/                          → the enforcement layer, imported unchanged
    ├── src/ledger/                       → validateForPost, buildReversal, reports
    └── src/repo (via @neurobook/db)      → postVoucher: one transaction, one place

apps/web/src/server/                      → lives in the app, not a package
    ├── trpc/                             → tRPC root router, one router per domain
    └── rest/                             → REST handlers for mobile + webhooks
```

**Access patterns by client:**

| Client   | Method                            | How                                    |
| -------- | --------------------------------- | -------------------------------------- |
| Web      | tRPC client + Server Actions      | Type-safe, no round-trip for mutations |
| Desktop  | tRPC client (local Next.js)       | Same code, hits local Next.js server   |
| Mobile   | REST — `/api/v1/*` Route Handlers | Standard HTTP fetch with JWT Bearer    |
| Webhooks | REST — `/api/v1/webhooks/`        | Public POST endpoint                   |

Both the tRPC procedures and the REST handlers delegate to the **same**
repository in `apps/web/src/db` — idempotency, sequence numbering and
immutability are implemented once, so the guarantee cannot drift between
clients (§15.1 R6). Duplicating that logic per transport is how R6 breaks.

### 6.2 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Next.js App (apps/web)                  │
│                                                          │
│  Server Components ──────────────▶ Drizzle ──▶ PostgreSQL│
│  Server Actions (mutations) ──────▶ ledger/ ──▶ Drizzle  │
│  tRPC Route Handler ──────────────▶ apps/web/src/server/trpc  │
│  REST Route Handlers /api/v1/* ───▶ apps/web/src/server/trpc  │
│  middleware.ts ───────────────────▶ auth + tenant scope  │
└──────┬──────────────────────┬──────────────────────┬────┘
       │                      │                      │
┌──────▼──────┐      ┌────────▼──────┐     ┌────────▼──────┐
│   Browser   │      │ Electron Shell │     │ React Native  │
│   (Web)     │      │ Next.js custom │     │ REST calls to │
│ tRPC client │      │ server (local) │     │ /api/v1/* RL  │
│ + RSC + SA  │      │ tRPC client    │     │ JWT Bearer    │
└─────────────┘      └───────┬───────┘     └───────────────┘
                             │ offline
                      ┌──────▼──────┐
                      │   SQLite    │
                      │(better-sq3) │
                      └─────────────┘
                             ↕ sync
                      ┌──────▼──────┐     ┌─────────────┐
                      │  PostgreSQL  │────▶│  BullMQ     │
                      │  + Redis     │     │  (workers)  │
                      └─────────────┘     └─────────────┘
```

### 6.3 Offline-First Strategy

- **Desktop (Electron)**: Next.js custom server runs locally inside Electron main process; SQLite via `better-sqlite3`; same Drizzle schema, swapped adapter
- **Offline detection**: `ELECTRON=true` env var switches DB adapter from PostgreSQL → SQLite
- **Mobile (React Native)**: `expo-sqlite` for offline reads/writes; syncs to `/api/v1/sync` on reconnect
- **Sync**: Server is authoritative — offline clients queue mutations with client-generated
  idempotency keys, posting requires connectivity, conflicts are surfaced to the user
  (never silently overwritten). See §15.3
- **BullMQ workers**: Triggered from Next.js Route Handlers/Server Actions; run as a separate sidecar process (Docker / Railway worker)

---

## 7. Authentication & Security

### 7.1 Auth Flow

1. User enters email + password (or OAuth)
2. Server verifies credentials → issues JWT (access + refresh)
3. Access token: short-lived (15 min), sent in `Authorization: Bearer`
4. Refresh token: long-lived (7 days), stored in httpOnly cookie
5. Tenant context extracted from JWT → all queries scoped to tenant

### 7.2 Security Measures

- Argon2id password hashing
- JWT signed with RS256 (private/public key), key rotation via `kid`
- TOTP 2FA (required for ADMIN and SUPER_ADMIN)
- Revocable refresh tokens (server-side session store)
- Rate limiting (300 req/min per tenant globally; auth endpoints 10/min per IP + per-user backoff — see §15.2 R14)
- CORS restricted to known origins
- SQL injection prevention via Drizzle ORM (parameterised queries)
- XSS: React auto-escaping + CSP headers
- CSRF: SameSite cookies + double-submit pattern
- Encryption at rest: AES-256 for backup files
- Audit log: every mutation logged with user + timestamp + IP

---

## 8. UI/UX Architecture

### 8.1 Shared Design System (`apps/web/src/ui/`)

- Built on shadcn/ui primitives
- Themed with Tailwind CSS
- Responsive breakpoints: mobile (< 768px), tablet (768-1024), desktop (> 1024)
- Dark mode support via CSS variables

### 8.2 Navigation Patterns

| Platform | Navigation                    |
| -------- | ----------------------------- |
| Web      | Next.js App Router (stack)    |
| Desktop  | Same as web (inside Electron) |
| Mobile   | Expo Router (tab + stack)     |

### 8.3 Key Screens

```
Dashboard
├── Summary cards (receivable, payable, cash, profit, expenses, stock)
├── Quick actions (create invoice, payment, journal, transfer, etc.)
├── Recent invoices
├── Recent payments
├── Recent transactions
└── Alerts (overdue invoices, low stock, etc.)

Accounts
├── Chart of Accounts (tree view)
├── Account ledger (transaction history, balances, etc.)
└── Account balance

Vouchers
├── List (filterable, sortable, paginated, searchable, exportable, printable)
├── Create / Edit form (multi-entry)
├── View (double-entry detail)
└── Approve / Reverse workflow

Invoices
├── Create (customer + items + tax)
├── PDF preview + download
├── Send (email/SMS)
└── Payment tracking

Reports
├── Trial Balance
├── Profit & Loss (period selector)
├── Balance Sheet
├── Cash Flow
├── VAT / TDS Reports
└── Export (PDF / Excel / CSV)

Bank Reconciliation
├── Import statement
├── Match transactions
├── Reconcile
└── Unreconciled items

Settings
├── Company profile
├── Fiscal year
├── Tax settings (VAT, TDS, etc.)
├── Payment gateways
├── Email templates
├── SMS templates
├── User management
├── Backup & Restore
└── Currency / Language
```

---

## 9. Development Workflow

### 9.1 Scripts (root `package.json`)

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:migrate": "turbo run db:migrate",
    "db:seed": "turbo run db:seed",
    "docs": "turbo run docs"
  }
}
```

### 9.2 Turborepo Pipeline

```
build → lint → typecheck → test → deploy

  web       ──────────────────────────────▶ deploy (Vercel)
  desktop   ──────────────────────────────▶ deploy (electron-builder)
  mobile    ──────────────────────────────▶ deploy (Expo EAS)
  workers   ──────────────────────────────▶ deploy (Docker / Railway sidecar)
  db        ──────────────────────────────▶ deploy (Supabase / self-hosted)
```

Note: the API lives **inside** `apps/web` (§6.1) — there is no separate `api`
service to deploy. Only the BullMQ workers need a long-running sidecar; they
cannot run on Vercel, so they ship as a Docker container running the same
`apps/web` build with `WORKER=true`.

### 9.3 Environment

```
# .env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/neurobook
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
STORAGE_BUCKET=neurobook-uploads
SMTP_HOST=smtp.example.com
SMTP_USER=apikey
SMTP_PASS=xxxx
```

---

## 10. Deployment

| Platform | Hosting / Build                       | CI/CD                       |
| -------- | ------------------------------------- | --------------------------- |
| Web      | Vercel (edge runtime)                 | GitHub Actions              |
| Workers  | Docker on Railway (sidecar, same web build, `WORKER=true`) | GitHub Actions |
| Desktop  | electron-builder → NSIS/DMG           | GitHub Actions + GH Release |
| Mobile   | Expo EAS Build → App Store/Play Store | GitHub Actions + EAS        |
| DB       | Supabase (managed PG)                 | Supabase migrations         |

---

## 11. Project Phases

### Phase 1 — MVP (Weeks 1-8)

- [x] Monorepo setup (npm workspaces, TS project references, Vitest) — two packages, `shared` and `db` (§2)
- [x] `packages/shared` — integer minor-unit money (`applyRate`, `roundMilliToMinor`), domain types, Zod schemas, BD lakh/crore formatters (§15.4 U3)
- [x] Ledger engine at `packages/shared/src/ledger` — post/reverse validation (R1, R2, R4), balance application, trial balance, P&L, balance sheet
- [x] Auth primitives in `packages/shared` — Argon2id, TOTP, RS256 JWT with `kid`, revocable sessions, rate limiting
- [x] Property tests + golden fixture (§15.5 O1) — engine and money
- [x] `apps/web/src/db` — Drizzle schema, RLS policies, gapless sequences, immutability + balance triggers
- [x] Repository layer (`apps/web/src/db/repo`) — the atomic post path: validate, reserve sequence, write header and lines in one transaction (R3, R4, R8)
- [x] Repository golden test — posts a real voucher, asserts the rows on disk, and reproduces the header-vs-lines case the original trigger could not see
- [ ] Web app (Next.js) — middleware for auth + tenant scope, server actions, dashboard, vouchers, reports
- [ ] Auth (register, login, JWT, tenant isolation, 2FA) — wired into `middleware.ts`
- [ ] Chart of Accounts CRUD
- [ ] Voucher types: Payment, Receipt, Journal, Sales Invoice, Purchase Invoice
- [ ] Web app (Next.js) — dashboard, vouchers, reports
- [ ] Basic reports: Trial Balance, P&L, Balance Sheet
- [ ] PDF export for invoices & reports
- [ ] Bengali (Bangla) UI — i18next with `bn` locale
- [ ] Lakh/crore number formatter in `packages/shared`
- [ ] ৳ Taka currency formatting
- [ ] Fiscal year default: 1 July – 30 June
- [ ] e-BIN / e-TIN fields on company & party profiles
- [ ] BD address fields (Division, District, Upazila, Union)

### Phase 2 — Desktop & Mobile (Weeks 9-16)

- [ ] Electron shell with web renderer
- [ ] Offline SQLite + sync
- [ ] React Native app (Expo)
- [ ] Mobile navigation + core screens
- [ ] Camera OCR for receipt scanning

### Phase 3 — Tax & Compliance (Weeks 17-22)

- [ ] VAT engine: 15% / reduced rates / zero-rated / exempt
- [ ] VDS (VAT Deducted at Source) tracking
- [ ] SD (Supplementary Duty) compound calculation
- [ ] Section-wise TDS (ITO §52, §52A, §52AA, §52B, §52BB, §53AA, §56)
- [ ] TDS challan + IT-105 return PDF
- [ ] TDS certificate generation
- [ ] Mushak 6.2 (sales invoice PDF — NBR format)
- [ ] Mushak 6.3, 6.4, 6.5 (credit/debit notes)
- [ ] Mushak 6.1, 6.10, 6.10A (purchase & sales registers)
- [ ] Mushak 6.8 (monthly VAT return — auto-populated)
- [ ] Mushak 6.7 (price declaration)
- [ ] e-BIN validation via NBR API
- [ ] AIT (Advance Income Tax) tracking
- [ ] Tax ledger automation

### Phase 4 — Advanced (Weeks 23-30)

- [ ] Bank reconciliation (CSV import + auto-match)
- [ ] Multi-currency support (USD, EUR — Taka as base)
- [ ] Inventory / stock management
- [ ] Recurring invoices
- [ ] Payment gateway: SSLCommerz, ShurjoPay, AamarPay
- [ ] MFS integration: bKash, Nagad, Rocket
- [ ] Role-based permissions (RBAC)

### Phase 5 — Polish & Scale (Weeks 31+)

- [ ] Audit log
- [ ] Backup automation + cloud storage
- [ ] Multi-language (i18n)
- [ ] Performance optimisation (SSR, caching, indexing)
- [ ] White-label theming
- [ ] API public (third-party integrations)

---

## 12. Key Design Decisions

1. **Monorepo (Turborepo)** — shared code, single commit, atomic changes across platforms.
2. **Double-entry engine in pure JS** — no accounting dependency; fully testable, portable across all platforms.
3. **PostgreSQL + SQLite** — relational for the cloud, embedded for offline. Same schema, same Drizzle ORM.
4. **Next.js full-stack** — tRPC + Route Handlers + Server Actions; no separate API server needed.
5. **Expo for React Native** — fastest path to iOS + Android with shared JS logic.
6. **Electron for desktop** — Next.js custom server inside Electron; single codebase for web + desktop.
7. **Offline-first** — every platform can work without network; sync when available.
8. **Bangladesh-first compliance** — built for NBR from day one: Mushak forms, VDS, SD, section-wise TDS, e-BIN/e-TIN, lakh/crore, ৳ Taka, fiscal year 1 Jul–30 Jun; extensible to other tax regimes.
9. **Bangla (Bengali) Phase 1** — `bn` locale ships with the MVP; not an afterthought.
10. **South Asian number system** — lakh/crore formatting in `packages/shared`; ৳ symbol throughout.

---

## 13. Testing Strategy

| Layer         | Framework      | Coverage Target |
| ------------- | -------------- | --------------- |
| Ledger engine | Vitest — property tests + golden fixture (`packages/shared/tests`) | 90%+ |
| Money / rounding | Vitest — millitaka boundary cases (`packages/shared/tests/money.test.ts`) | 100% |
| Repository / triggers | Vitest against a live Postgres, as the non-superuser role (`apps/web/tests`) | Critical paths |
| API routes    | Vitest + MSW   | 80%+            |
| Components    | Playwright     | Critical paths  |
| E2E           | Playwright     | Full workflows  |
| Mobile        | Expo Go + Jest | 80%+            |

The property tests assert the §15.5 O1 invariants over hundreds of
randomly-generated balanced transaction sets: trial balance foots to zero,
`Assets == Liabilities + Equity + RetainedEarnings`, and a reversal nets its
original to exactly zero. The golden fixture is a fixed, hand-auditable set of
books with hardcoded expected numbers.

---

## 14. Open Questions / Future Decisions

- [x] Multi-lingual UI: **i18next** — `en` + `bn` (Bangla) from Phase 1
- [x] Real-time collaboration: **WebSockets**
- [x] Payment gateways: **SSLCommerz, ShurjoPay, AamarPay, bKash, Nagad, Rocket**
- [x] SaaS vs self-hosted: **self-hosted**
- [x] Plugin/extension system for custom reports: **yes**
- [ ] NBR e-filing API integration (direct online VAT/TDS submission)?
- [ ] AI assistant for bookkeeping suggestions (on-device LLM via Ollama)?
- [ ] BFRS (Bangladesh Financial Reporting Standards) full compliance checklist?

---

## 15. Robustness & UX Requirements

Non-negotiable constraints enforced from the first commit. Each item is testable;
a PR that violates one must not merge.

### 15.1 Ledger Integrity (P0 — expensive to retrofit)

| # | Rule | Enforcement |
| - | ---- | ----------- |
| R1 | **Posted vouchers are immutable.** No UPDATE/DELETE on a posted voucher. Corrections are a reversal voucher referencing the original. | DB row-level trigger + repository guard + API layer check. The trigger permits exactly one write on a `posted` row: the transition to `reversed`, made by the reversal procedure. The `voucher.delete` permission means reverse, never remove. |
| R2 | **Period locking.** A fiscal period can be closed; posting into a closed period is rejected (`PERIOD_LOCKED`). Only `SUPER_ADMIN` may reopen, and reopening is itself audit-logged. | `fiscal_periods` table with `status: open \| closed`, checked inside the post transaction. |
| R3 | **Gapless, legal sequence numbers.** Bangladesh Mushak/e-invoice numbering must be sequential and gapless. Never `max(id)+1`. | `voucher_sequences` table per (tenant, voucher_type, fiscal_year), incremented via `SELECT … FOR UPDATE` inside the same transaction as the post (R8). The serialisation is deliberate and bounds post throughput per (tenant, type) — a Postgres `SEQUENCE` is not usable here because a rolled-back transaction would still consume a number and break the sequence. Voided numbers are consumed, never reused. |
| R4 | **Balance check at post.** Debits == credits exactly, at least two lines, non-negative amounts. Rejected as `UNBALANCED`. | `ledger/` engine validation plus a DB trigger that recomputes `Σdebit` and `Σcredit` **from the journal lines** and asserts both non-negativity and equality against the stored voucher totals. A CHECK on the voucher row alone proves nothing about the entries — the ledger must foot to the minor unit. |
| R5 | **Optimistic concurrency on every mutable record.** `version INT NOT NULL DEFAULT 1`; writes carry `WHERE version = $n`, mismatch → `CONFLICT` (HTTP 409). | All update statements generated through one helper. |
| R6 | **Idempotency.** All mutations accept `Idempotency-Key`; a replay within 24h returns the original response. Duplicate-key violations are handled, not surfaced as 500s. | `idempotency_keys` table keyed (tenant, key). Applies to the tRPC procedures **and** the REST handlers; both route through the same procedure so the guarantee cannot drift between clients. |
| R7 | **Money is integer minor units, with an explicit rounding policy.** Store `INTEGER` minor units (taka × 100). No `float`/`double` columns and no raw `Number` arithmetic in any money path. Compute tax at millitaka (3 dp) — the cases that actually need it are the **7.5% reduced band** and fractional quantities, e.g. `0.15 × 2.5 = 0.375` — then round per line to minor units and post any residual against a per-company `Rounding Difference` account so the voucher always balances exactly. | Central `roundMoney()` in `packages/shared`, one implementation, used by the engine, reports, PDF and Excel export. |
| R8 | **Atomic post.** Sequence increment, balance validation, and the journal write are one transaction. All-or-nothing. | Single Drizzle transaction wrapper. |

### 15.2 Multi-Tenancy & Security (P0)

| # | Rule |
| - | ---- |
| R9  | **One authoritative isolation mechanism.** PostgreSQL RLS enforces; the app-layer `tenant_id` filter is a defence-in-depth duplicate, never the sole guard. An automated test enumerates every table and asserts an RLS policy exists. |
| R10 | **No cross-tenant query can be constructed.** Tenant context is resolved once per request from the verified token and threaded through; ad-hoc `db.select()` without the scope is blocked at the repository layer. |
| R11 | **Argon2id** for password hashing (not bcrypt). |
| R12 | **TOTP 2FA** optional per user, required for `ADMIN` and `SUPER_ADMIN`. |
| R13 | **Refresh tokens are revocable.** Server-side session table; logout and credential change invalidate immediately. Access tokens stay short-lived (15 min). |
| R14 | **Per-route rate limits.** `300/min per tenant` is the global ceiling. Auth endpoints get `10/min per IP` plus per-user exponential backoff after failures — the per-IP ceiling is deliberately not lower, because many Bangladeshi offices sit behind one NAT address and a hard `5/min` would lock out a whole firm at 9am. |
| R15 | **Audit log is append-only and complete** — every mutation records user, tenant, IP, before/after diff, timestamp. |
| R16 | **Encryption at rest** for backups (AES-256) and for columns holding secrets (gateway keys, SMTP credentials). |

### 15.3 Offline & Sync (P0 — replaces the append-only merge model)

Server is the single source of truth for posted data.

- **Offline clients queue mutations locally** with a client-generated
  `Idempotency-Key`; the queue is durable and survives app restart.
- **Drafts may be created and edited offline. Posting requires connectivity** —
  posting is an authoritative server-side act and is never performed locally.
- **No silent merge of money.** The previous "server merges by sequence +
  timestamp" model is withdrawn: entries are immutable (reverse-only), so there
  is nothing to merge. On conflict the server rejects and the client surfaces a
  resolution screen; it never silently overwrites.
- **Sync state is visible to the user at all times** — pending count, last-synced
  time, per-item status (`synced \| pending \| conflict`). No silent failure, ever.
- **Optimistic UI with rollback.** Local writes render immediately; a failed or
  conflicted sync reverts the UI and shows the error inline.

### 15.4 UX Requirements

| # | Requirement |
| - | ----------- |
| U1 | **Keyboard-first voucher entry** — the core reason users tolerate Tally's UI. Every field reachable without the mouse: Enter = next field, `Ctrl+Enter` = save, `Alt+N` = new voucher, `Esc` = cancel, `F4` = ledger popup, numeric shortcuts per voucher type. After save, focus returns to the next blank voucher, ready for the next entry. |
| U2 | **Onboarding & migration path** — new company → apply the Bangladesh chart-of-accounts template (which **must include the `Rounding Difference` account that R7 depends on**) → import opening trial balance from Excel/Tally. This is the primary blocker to switching off Tally; it is a first-class flow, not a settings page. |
| U3 | **Bangladesh number and date formats** — lakh/crore grouping via `Intl.NumberFormat('en-IN')` (`##,##,###`), dates `dd/mm/yy`. One shared formatter, used everywhere including PDF and Excel export. |
| U4 | **Three explicit UI states for every async surface** — loading (skeleton, not spinner-only), empty (with a call to action), error (field-level where possible, actionable message, retry). Never a blank page. |
| U5 | **Print is a first-class output** — A4 print CSS for invoices and vouchers, plus dot-matrix-friendly compact mode. |
| U6 | **Virtualised tables** — ledgers routinely hold 100k+ rows. All list views virtualise; no full-page re-render on scroll. |
| U7 | **Soft-delete is reversal-only** for vouchers; reference data (parties, products) is deactivated, never removed, to preserve historical reports. |
| U8 | **Form validation from the shared Zod schemas** — one schema drives client errors, server validation, and the API contract. Error messages are user-readable, in the active locale. |
| U9 | **Accessibility** — WCAG 2.2 AA targets on all flows; dense data tables ship proper `th`/`scope`, focus-visible states, and keyboard-reachable sort/filter. |

### 15.5 Operability

| # | Requirement |
| - | ----------- |
| O1 | **Golden ledger fixture** — a fixed set of books with hardcoded expected trial-balance, P&L, and balance-sheet numbers. `Assets == Liabilities + Equity` and `Σdebit == Σcredit` must hold to the minor unit. This is the `ledger/` engine's real safety net; CI fails if it drifts. |
| O2 | **Backups are only real if restored.** Scheduled job restores the latest backup into a scratch database and verifies row counts and a checksum. |
| O3 | **Observability from day one** — structured logging, error reporting (Sentry), `/health` and `/ready` endpoints, and per-tenant request metrics. |
| O4 | **Migrations are reversible and reviewed** — every migration ships `up` and `down`; schema changes require a migration, never a manual `ALTER`. |
| O5 | **Secrets never in the repo.** `.env.example` documents only; real values injected at deploy. `config/` package validates the env schema at boot and fails loudly on a missing required key. |

---

_Last updated: 2026-09-16 (ledger engine + §15 robustness contract)_
