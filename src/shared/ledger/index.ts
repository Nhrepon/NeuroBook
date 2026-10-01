// Ledger engine. Pure functions only — no I/O, no DB. Used by both the web
// repository (apps/web/src/db/repo) and by mobile (expo-sqlite cache) for
// pre-flight validation. The DB triggers in apps/web enforce the same
// invariants at the storage layer; the engine is the first line, not the only.

// Re-export the domain types so `@neurobook/shared/ledger` is the only
// import the repo layer needs.
export type { JournalEntry, Voucher, VoucherType, AccountType, VoucherStatus } from '../types'
export * from './post'
export * from './reversal'
export * from './reports'
export * from './voucherTypes'
export * from './errors'
