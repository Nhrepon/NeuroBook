/**
 * Ledger post path — §15.1 R1–R8.
 *
 * The pure-engine side of posting. The DB side (row-level immutability trigger,
 * SELECT … FOR UPDATE sequence increment, recomputing balance trigger) lives in
 * the repository; this module is the single validation authority that both the
 * tRPC procedures and the REST handlers delegate to, so R6 cannot drift.
 */
import {
  type Account,
  type JournalEntry,
  type Transaction,
  normalSide,
  transactionSchema,
} from "../index.js";
import {
  ALREADY_POSTED,
  ALREADY_REVERSED,
  IMMUTABLE_POSTED,
  NOT_POSTED,
  PERIOD_LOCKED,
  UNBALANCED,
  UNKNOWN_ACCOUNT,
} from "./errors.js";

export interface FiscalPeriod {
  startDate: Date;
  endDate: Date;
  status: "open" | "closed";
}

export interface PostContext {
  /** The tenant's chart of accounts, for existence checks. */
  accounts: ReadonlyMap<string, Account>;
  /** Open/closed fiscal periods; posting into a closed one is rejected. */
  periods?: FiscalPeriod[];
}

/**
 * Validate a voucher for posting. Throws LedgerError on any violation.
 *
 * R4: balanced exactly, ≥2 lines, non-negative, totals agree with the entries.
 * R2: not into a closed period.
 * R1: a posted voucher may not be edited; the only write it permits is the
 *     transition into `reversed`, performed by reverse().
 */
export function validateForPost(tx: Transaction, ctx: PostContext): void {
  // Re-run the schema first: it catches malformed money (negative, non-integer)
  // and the UNBALANCED invariants before any business rule.
  const parsed = transactionSchema.safeParse(tx);
  if (!parsed.success) {
    throw UNBALANCED;
  }

  if (tx.status === "posted") throw ALREADY_POSTED;
  if (tx.status === "reversed") throw ALREADY_REVERSED;

  if (ctx.periods) {
    const period = ctx.periods.find(
      (p) => tx.date >= p.startDate && tx.date <= p.endDate,
    );
    if (period?.status === "closed") throw PERIOD_LOCKED;
  }

  for (const e of tx.entries) {
    if (!ctx.accounts.has(e.accountId)) throw UNKNOWN_ACCOUNT;
  }
}

/**
 * Guard on edit. A posted voucher is immutable (R1); the sole permitted write
 * is the `posted → reversed` transition, which goes through reverse().
 */
export function validateForEdit(tx: Transaction): void {
  if (tx.status === "posted") throw IMMUTABLE_POSTED;
  if (tx.status === "reversed") throw ALREADY_REVERSED;
}

/**
 * Build the reversal voucher for a posted transaction (R1).
 *
 * Every entry is mirrored: debits become credits and vice versa. The original
 * is linked via reversedById. A reversal is itself a postable voucher, so it
 * goes through the same validateForPost.
 */
export function buildReversal(original: Transaction, reversalId: string): Transaction {
  if (original.status !== "posted") throw NOT_POSTED;

  const entries: JournalEntry[] = original.entries.map((e) => ({
    accountId: e.accountId,
    accountType: e.accountType,
    debit: e.credit,
    credit: e.debit,
    reference: e.reference,
  }));

  return {
    id: reversalId,
    date: new Date(),
    narration: `Reversal of ${original.id}: ${original.narration}`,
    entries,
    totalDebit: original.totalCredit,
    totalCredit: original.totalDebit,
    status: "draft",
    version: 1,
    idempotencyKey: undefined,
    sequenceNumber: undefined,
    reversedById: original.id,
  };
}

/**
 * Apply a posted transaction to a running map of account balances.
 *
 * Balances are signed toward the account's normal side, so an asset debited
 * increases and an asset credited decreases. This is the arithmetic the trial
 * balance, P&L and balance sheet are all derived from, in one place.
 *
 * A reversed voucher stays in the ledger and is still applied: its reversal
 * voucher carries mirrored entries, so the pair nets to exactly zero. This is
 * why `reversed` is not skipped — removing it would double-count the reversal
 * and leave the books off by twice the original amount.
 */
export function applyTransaction(
  balances: Map<string, number>,
  tx: Transaction,
): Map<string, number> {
  if (tx.status === "draft") return balances;
  // posted and reversed are both part of the ledger; the net effect is what matters.

  for (const e of tx.entries) {
    const side = normalSide(e.accountType);
    const current = balances.get(e.accountId) ?? 0;
    // debit increases a debit-normal account; credit decreases it. Mirror for credit-normal.
    const delta = side === "debit" ? e.debit - e.credit : e.credit - e.debit;
    balances.set(e.accountId, current + delta);
  }
  return balances;
}
