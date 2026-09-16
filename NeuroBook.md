# NeuroBook — Accounting Platform Architecture (Tally Prime Alternative)

## 1. Overview

NeuroBook is a multi-platform accounting application inspired by Tally Prime. It provides
invoicing, ledger management, VAT/Tax compliance, bank reconciliation, financial reporting, Inventory Management
and multi-tenancy — across three platforms from a single codebase:

| Platform | Technology               | Target                                |
| -------- | ------------------------ | ------------------------------------- |
| Web      | Next.js 15+ (App Router) | Browser — SaaS / hosted               |
| Desktop  | Electron                 | Windows, macOS, Linux (offline-first) |
| Mobile   | React Native             | iOS, Android (offline-first)          |

---

## 2. Monorepo Structure

```
neurobook/
├── apps/
│   ├── web/                  # Next.js 15+ (App Router)
│   ├── desktop/              # Existing Next.js + Electron
│   └── mobile/               # React Native (Expo)
├── packages/
│   ├── shared/               # Shared types, constants, utils
│   ├── api/                  # Next.js API (shared API layer)
│   ├── db/                   # Drizzle ORM + migrations
│   ├── auth/                 # Auth utilities (JWT, sessions)
│   ├── ui/                   # Shared component library (shadcn/ui)
│   ├── ledger/               # Core accounting engine (JS library)
│   └── config/               # ESLint, Prettier, TS config, env schema
├── docs/
│   └── NeuroBook.md          # This file
├── package.json              # Root workspace config
├── turbo.json                # Turborepo pipeline
└── docker-compose.yml        # Local dev infrastructure
```

---

## 3. Technology Stack

### 3.1 Web (Next.js)

- **Framework**: Next.js 15+ (App Router, Server Components, Server Actions)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (client) + React Query (server cache)
- **Forms**: React Hook Form + Zod validation (Server Actions for mutations)
- **RPC**: tRPC v11 (mounted on Next.js Route Handler — type-safe, no codegen)
- **Charts**: Recharts or Chart.js
- **PDF generation**: @react-pdf/renderer or jsPDF
- **Auth**: NextAuth.js v5 (credentials + OAuth)

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

### 3.4 Shared Packages

- **shared**: Zod schemas, enums, constants (account types, tax rates, BD tax sections, Mushak form types)
- **bd-compliance**: Bangladesh-specific tax engine — Mushak form generator, VDS/SD calculator, section-wise TDS, e-BIN/e-TIN validator, lakh/crore formatter, BD fiscal year utils
- **api**: tRPC v11 router (mounted on Next.js — type-safe RPC for web/desktop; REST Route Handlers for mobile)
- **db**: Drizzle ORM with PostgreSQL (primary) + SQLite (mobile/desktop offline)
- **auth**: JWT signing/verification, session management, role-based access
- **ledger**: Pure JS accounting engine — double-entry bookkeeping,
  journal entries, trial balance, P&L, balance sheet
- **ui**: Shared button, input, table, modal, toast components

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
  totalDebit: number
  totalCredit: number
  status: 'draft' | 'posted' | 'reversed'
}

JournalEntry {
  accountId: string
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  debit: number
  credit: number
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

- Each organisation is a tenant with isolated data (row-level security in PostgreSQL)
- Schema: `tenant_id` on every table
- Auth middleware resolves tenant from JWT

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

packages/api/
└── src/
    ├── router.ts                      → tRPC root router (appRouter)
    ├── routers/
    │   ├── vouchers.ts
    │   ├── invoices.ts
    │   ├── reports.ts
    │   ├── accounts.ts
    │   └── ...                        → one router per domain
    └── context.ts                     → tRPC context (session, tenant, db)
```

**Access patterns by client:**

| Client   | Method                            | How                                    |
| -------- | --------------------------------- | -------------------------------------- |
| Web      | tRPC client + Server Actions      | Type-safe, no round-trip for mutations |
| Desktop  | tRPC client (local Next.js)       | Same code, hits local Next.js server   |
| Mobile   | REST — `/api/v1/*` Route Handlers | Standard HTTP fetch with JWT Bearer    |
| Webhooks | REST — `/api/v1/webhooks/`        | Public POST endpoint                   |

### 6.2 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Next.js App (apps/web)                  │
│                                                          │
│  Server Components ──────────────▶ Drizzle ──▶ PostgreSQL│
│  Server Actions (mutations) ──────▶ ledger/ ──▶ Drizzle  │
│  tRPC Route Handler ──────────────▶ packages/api/router  │
│  REST Route Handlers /api/v1/* ───▶ packages/api/router  │
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
- **Sync**: Append-only event log per device — accounting entries are immutable (reversed, never edited); server merges by sequence + timestamp
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

- Bcrypt password hashing (12 rounds)
- JWT signed with RS256 (private/public key)
- Rate limiting (300 req/min per tenant)
- CORS restricted to known origins
- SQL injection prevention via Drizzle ORM (parameterised queries)
- XSS: React auto-escaping + CSP headers
- CSRF: SameSite cookies + double-submit pattern
- Encryption at rest: AES-256 for backup files
- Audit log: every mutation logged with user + timestamp + IP

---

## 8. UI/UX Architecture

### 8.1 Shared Design System (`packages/ui/`)

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
  api       ──────────────────────────────▶ deploy (Docker / Railway)
  db        ──────────────────────────────▶ deploy (Supabase / self-hosted)
```

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
| Desktop  | electron-builder → NSIS/DMG           | GitHub Actions + GH Release |
| Mobile   | Expo EAS Build → App Store/Play Store | GitHub Actions + EAS        |
| API      | Docker on Railway / Fly.io            | GitHub Actions              |
| DB       | Supabase (managed PG)                 | Supabase migrations         |

---

## 11. Project Phases

### Phase 1 — MVP (Weeks 1-8)

- [x] Monorepo setup with Turborepo
- [x] Shared packages (types, ledger engine, DB schema)
- [x] PostgreSQL + Drizzle + migrations
- [x] Auth (register, login, JWT, tenant isolation)
- [x] Chart of Accounts CRUD
- [x] Voucher types: Payment, Receipt, Journal, Sales Invoice, Purchase Invoice
- [x] Web app (Next.js) — dashboard, vouchers, reports
- [x] Basic reports: Trial Balance, P&L, Balance Sheet
- [x] PDF export for invoices & reports
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
| Ledger engine | Vitest         | 90%+            |
| API routes    | Vitest + MSW   | 80%+            |
| Components    | Playwright     | Critical paths  |
| E2E           | Playwright     | Full workflows  |
| Mobile        | Expo Go + Jest | 80%+            |

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

_Last updated: 2026-09-08_
