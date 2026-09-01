# NeuroBook — Accounting Platform Architecture (Tally Prime Alternative)

## 1. Overview

NeuroBook is a multi-platform accounting application inspired by Tally Prime. It provides
invoicing, ledger management, VAT/Tax compliance, bank reconciliation, financial reporting, Inventory Management
and multi-tenancy — across three platforms from a single codebase:

| Platform | Technology               | Target                                |
| -------- | ------------------------ | ------------------------------------- |
| Web      | Next.js 16+ (App Router) | Browser — SaaS / hosted               |
| Desktop  | Electron                 | Windows, macOS, Linux (offline-first) |
| Mobile   | React Native             | iOS, Android (offline-first)          |

---

## 2. Monorepo Structure

```
neurobook/
├── apps/
│   ├── web/                  # Next.js 16+ (App Router)
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

- **Framework**: Next.js 16+ (App Router, Server Components)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (client) + React Query (server cache)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts or Chart.js
- **PDF generation**: @react-pdf/renderer or jsPDF
- **Auth**: NextAuth.js (credentials + OAuth)

### 3.2 Desktop (Electron)

- **Shell**: Electron 30+ (main + renderer)
- **Renderer**: Next.js (static export or custom server)
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

- **shared**: Zod schemas, enums, constants (account types, tax rates)
- **api**: Hono-based HTTP API or tRPC router (type-safe RPC)
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

- Create/send invoices (PDF attachment)
- Recurring invoices
- Payment tracking (partial, full, overdue)
- SMS/email notification (via Twilio / SendGrid)

### 5.5 VAT & TDS Compliance (Bangladesh focus, extensible)

- Auto-calculation of VAT/TDS
- Input tax credit, output tax liability, input tax liability and output tax credit
- VAT & TDS Summary Reports
- Challan (e-invoice)
- TDS Return
- VAT Return
- Mushak (e-bill)

### 5.6 Bank Reconciliation

- Import bank statement (CSV, OFX, QIF, etc.)
- Auto-match transactions by amount + date
- Manual match/unmatch
- Reconciliation status per account

### 5.7 Reporting

- Trial Balance
- Profit & Loss (P&L)
- Balance Sheet
- Cash Flow Statement
- VAT & TDS Summary Reports
- Ageing Report (receivables/payables)
- Bank Statement
- Export: PDF, Excel (XLSX), CSV
- Download: PDF, Excel (XLSX), CSV

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

### 6.1 API Layer (`packages/api/`)

```
Hono App (or tRPC)
├── /api/v1/auth/          → login, register, refresh, logout
├── /api/v1/companies/     → CRUD tenants
├── /api/v1/accounts/      → chart of accounts CRUD
├── /api/v1/vouchers/      → transaction CRUD
├── /api/v1/invoices/      → invoice CRUD + PDF
├── /api/v1/reports/       → P&L, balance sheet, trial balance, cash flow, ageings, bank statement, VAT/TDS, inventory
├── /api/v1/taxes/           → taxes, reports, e-invoice, e-bill
├── /api/v1/vat/           → taxes, reports, e-invoice, e-bill
├── /api/v1/customers/    → customer CRUD
├── /api/v1/suppliers/     → supplier CRUD
├── /api/v1/products/      → product CRUD
├── /api/v1/users/         → user CRUD
├── /api/v1/bank/          → reconciliation
├── /api/v1/backup/        → create, list, restore
├── /api/v1/settings/      → company settings, user prefs
└── /api/v1/webhooks/      → payment gateway callbacks
```

### 6.2 Data Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  Web App  │────▶│  API Gateway │────▶│  Hono / tRPC    │
│ (Next.js) │     │  (Next.js    │     │  Server          │
│           │     │   API routes)│     │                  │
└──────────┘     └──────────────┘     └────────┬────────┘
                                                │
┌──────────┐     ┌──────────────┐              │    ┌──────────┐
│ Desktop   │────▶│  Electron    │──────────────┼────▶│ PostgreSQL│
│ (Electron)│     │  Main Process│              │     │  + Redis  │
│           │     │  + Renderer  │              │     └──────────┘
└──────────┘     └──────────────┘              │
                                                │
┌──────────┐     ┌──────────────┐              │    ┌──────────┐
│ Mobile    │────▶│  Expo Go /   │──────────────┼────▶│ SQLite   │
│ (RN)      │     │  Build       │              │     │ (offline)│
│           │     │              │              │     └──────────┘
└──────────┘     └──────────────┘              │
                                                │
                                         ┌──────▼──────┐
                                         │  BullMQ     │
                                         │  (queues)   │
                                         └─────────────┘
```

### 6.3 Offline-First Strategy

- **Desktop (Electron)**: SQLite local DB + sync to PostgreSQL when online
- **Mobile (React Native)**: expo-sqlite for offline reads/writes, sync on reconnect
- **Sync**: Conflict-free replicated data types (CRDTs) or last-write-wins with vector clocks
- **Queue**: Background sync via BullMQ workers

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

### Phase 2 — Desktop & Mobile (Weeks 9-16)

- [ ] Electron shell with web renderer
- [ ] Offline SQLite + sync
- [ ] React Native app (Expo)
- [ ] Mobile navigation + core screens
- [ ] Camera OCR for receipt scanning

### Phase 3 — Tax & Compliance (Weeks 17-22)

- [ ] Tax calculation engine (Tally Prime-like)
- [ ] VAT / TDS support
- [ ] Mushak e-bill generation
- [ ] E-invoice JSON output
- [ ] Tax ledger automation

### Phase 4 — Advanced (Weeks 23-30)

- [ ] Bank reconciliation (CSV import + auto-match)
- [ ] Multi-currency support
- [ ] Inventory / stock management
- [ ] Recurring invoices
- [ ] Payment gateway integration (Razorpay / Stripe)
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
4. **Hono over Express** — lightweight, type-safe, works on edge (Vercel) and Node (Electron).
5. **Expo for React Native** — fastest path to iOS + Android with shared JS logic.
6. **Electron for desktop** — web tech in a native shell; single codebase for web + desktop renderer.
7. **Offline-first** — every platform can work without network; sync when available.
8. **Bangladesh-first compliance** — built for Bangladesh compliance from day one; extensible to other tax regimes.

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

- [ ] Multi-lingual UI: i18next or next-intl? - i18next
- [ ] Real-time collaboration: WebSockets or CRDTs? - webSockets
- [ ] AI assistant for bookkeeping suggestions (on-device LLM via Ollama)?
- [ ] Plugin/extension system for custom reports? - yes
- [ ] White-label SaaS vs self-hosted only? - self-hosted

---

_Last updated: 2026-08-23_
