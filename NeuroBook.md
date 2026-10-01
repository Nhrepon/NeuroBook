# NeuroBook — Accounting Platform Architecture (Tally Prime Alternative)

> **Revision:** Next.js 16 + React 19 (web) · Expo SDK latest / React Native New Architecture (mobile). No Electron, no tRPC, no BullMQ sidecar. Server Actions + REST only.

---

## 1. Overview

NeuroBook is a multi-platform accounting application inspired by Tally Prime.
Invoicing, ledger management, VAT/Tax compliance, bank reconciliation, financial
reporting, inventory, multi-tenancy — across two clients from a single codebase:

| Platform | Technology                                    | Target                       |
| -------- | --------------------------------------------- | ---------------------------- |
| Web      | Next.js 16 (App Router, React 19, Turbopack)  | Browser — SaaS / hosted      |
| Mobile   | React Native via Expo SDK 57 (New Architecture, RN 0.86) | iOS, Android (offline-first) |

---

## 2. App Structure

```
neurobook/
├── apps/
│   ├── web/                   # Next.js 16 (App Router) — backend + UI in one
│   │   ├── src/
│   │   │   ├── app/           # routes, app/api/v1/*/route.ts, server actions
│   │   │   ├── db/            # Drizzle schema, client, migrations, postVoucher repo
│   │   │   ├── ui/            # shadcn/ui-based component library
│   │   │   └── middleware.ts  # auth verification + tenant scope (R9/R10)
│   │   └── drizzle.config.ts
│   └── mobile/                # Expo (New Architecture) — imports packages/shared only,
│                              # talks to apps/web over REST with JWT Bearer
├── packages/
│   └── shared/                # The one shared boundary. Pure JS, no framework:
│                              # types, Zod schemas, integer money, the ledger
│                              # engine, BD formatters, auth primitives
├── NeuroBook.md               # This file
├── package.json               # Root workspace config (npm workspaces)
└── docker-compose.yml         # Local dev: Postgres, Redis, MinIO
```

### 3 Mobile (React Native via Expo)

- **Framework**: Expo SDK latest (React Native 0.79+, New Architecture enabled by default)
- **Navigation**: Expo Router v3+ (file-based, typed routes, deep linking)
- **State**: Zustand (UI state) + TanStack Query (server cache)
- **Storage**: `expo-secure-store` (tokens), `expo-sqlite` (offline data)
- **PDF**: `expo-print` + `expo-sharing`
- **Camera/Scan**: `expo-camera` + `expo-text-recognition` (OCR for receipts)
- **Push**: Expo Notifications + EAS
- **Auth**: same JWT flow as web
- **Native primitives**: New Architecture only — Fabric (renderer) + TurboModules + JSI. No legacy bridge.



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
  version: int              // optimistic concurrency (R5)
  idempotencyKey?: string   // safe retry (R6)
  sequenceNumber?: string   // gapless legal numbering, assigned at post (R3)
  reversedById?: string     // link to the reversal voucher, if reversed
}

// Money is integer minor units (taka × 100) — never float/double. See R7.

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
  defence-in-depth, never the sole guard (R9)
- Schema: `tenant_id` on every table, with an automated test asserting an RLS
  policy exists on each one
- Auth middleware resolves tenant from the verified JWT and threads it through
  the request scope; unscoped queries are blocked at the repository layer (R10)

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

- Full DB dump (PostgreSQL `pg_dump`)
- Encrypted backup files (AES-256)
- Restore from file or cloud storage
- Auto-backup schedule (cron via Vercel Cron or external scheduler)

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


## 6. Authentication & Security

### 6.1 Auth Flow

1. User enters email + password (or OAuth)
2. Server verifies credentials → issues JWT (access + refresh)
3. Access token: short-lived (15 min), sent in `Authorization: Bearer`
4. Refresh token: long-lived (7 days), stored in `expo-secure-store` (mobile)
   or httpOnly cookie (web)
5. Tenant context extracted from JWT → all queries scoped to tenant

### 6.2 Security Measures

- Argon2id password hashing
- JWT signed with RS256 (private/public key), key rotation via `kid`
- TOTP 2FA (required for ADMIN and SUPER_ADMIN)
- Revocable refresh tokens (server-side session store)
- Rate limiting (300 req/min per tenant globally; auth endpoints 10/min per IP + per-user backoff — see R14)
- CORS restricted to known origins
- SQL injection prevention via Drizzle ORM (parameterised queries)
- XSS: React auto-escaping + CSP headers
- CSRF: SameSite cookies + double-submit pattern
- Encryption at rest: AES-256 for backup files
- Audit log: every mutation logged with user + timestamp + IP

### 6.3 API Versioning & Mobile Compatibility

The REST surface at `/api/v1/*` is a **published contract**. Mobile apps run
on devices the user controls and upgrades on their own schedule, so breaking
it means breaking installed apps that cannot be force-patched.

**Versioning policy**

- Versions are URL-path segments: `/api/v1/*`, `/api/v2/*`. No header-based
  negotiation — a path segment is visible in logs, debuggable by support
  staff, and trivially cacheable.
- A new major version is the **only** way to ship a breaking change: removed
  fields, changed types, changed semantics, restructured responses.
- Within a major version, changes are **additive only** — new optional
  fields, new endpoints, new enum values (clients must treat unknown enum
  values as "unknown" and render them gracefully, never as an error).
- A deprecated version stays served for **12 months** after its successor
  ships. Deprecation is signalled by the `Sunset` header (RFC 8594) and
  logged on the server so usage can be measured per app version before the
  version is actually withdrawn.

**Client version gating**

The API returns version constraints on every response so the app can refuse
to operate against a backend it cannot talk to, rather than failing in
confusing ways mid-flow:

```
X-Api-Version: 1
X-Min-Client-Version: 1.4.0     # below this, hard block
X-Recommended-Client-Version: 1.6.2  # below this, soft prompt
Sunset: Sun, 30 Sep 2027 00:00:00 GMT  # only on a deprecated version
```

- **Hard block** (`X-Min-Client-Version`): the app shows a blocking upgrade
  screen. Used only when a security fix or a data-integrity change makes the
  old client dangerous — for an accounting app, a client that could post an
  unbalanced voucher is dangerous, not merely inconvenient.
- **Soft prompt** (`X-Recommended-Client-Version`): a non-blocking banner,
  once per version, dismissible.
- The Expo app sends `X-Client-Version` and `X-Client-Platform: ios|android`
  on every request so the server can target constraints per platform, and so
  support can see exactly which app version hit which API version.

**Evolution rules**

- Add a field → ship it; old clients ignore it.
- Remove a field → new major version, old version keeps serving it.
- Change a field's meaning (e.g. `amount` from minor units to major) → new
  major version. This is the one that bites: a _renamed_ field fails loudly,
  a _reinterpreted_ field silently corrupts money.
- Response payloads are validated against the shared Zod schemas in tests on
  **both** sides, so a server-side drift that would break installed mobile
  apps is caught in CI rather than in production.

---

## 7. UI/UX Architecture

### 7.1 Shared Design System (`apps/web/src/ui/`)

- Built on shadcn/ui primitives (Radix UI under the hood)
- Themed with Tailwind CSS v4
- Responsive breakpoints: mobile (< 768px), tablet (768–1024), desktop (> 1024)
- Dark mode support via CSS variables
- Mobile reuses the same component tokens via Expo's Tailwind preset; visual
  parity, not code sharing — RN components are rendered with `nativewind` or
  platform-native primitives.

### 7.2 Navigation Patterns

| Platform | Navigation                                |
| -------- | ----------------------------------------- |
| Web      | Next.js App Router (stack, parallel, intercepting) |
| Mobile   | Expo Router v3+ (typed routes, tab + stack) |

### 7.3 Key Screens

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
