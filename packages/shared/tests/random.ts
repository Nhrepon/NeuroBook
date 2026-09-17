/**
 * Property-test generators for the ledger engine.
 *
 * The strategy: generate *arbitrary valid* transaction sets and assert the
 * invariants that must hold for any set of balanced postings — trial balance
 * foots to zero, Assets == Liabilities + Equity, and a reversal nets its
 * original to exactly zero. A bug that only appears at particular amounts or
 * account combinations is found by the fuzzer, not by a hand-written case.
 */
import type { Account, JournalEntry, Transaction } from "@neurobook/shared";
import { normalSide } from "@neurobook/shared";

export const TEST_ACCOUNTS: Account[] = [
  { id: "cash", name: "Cash in Hand", code: "1001", type: "ASSET", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "bank", name: "Bank Account", code: "1200", type: "ASSET", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "ar", name: "Sundry Debtors", code: "1300", type: "ASSET", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "inventory", name: "Inventory", code: "1400", type: "ASSET", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "ap", name: "Sundry Creditors", code: "2100", type: "LIABILITY", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "vat-payable", name: "VAT Payable", code: "2200", type: "LIABILITY", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "capital", name: "Capital Account", code: "3001", type: "EQUITY", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "rounding", name: "Rounding Difference", code: "3999", type: "EQUITY", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "sales", name: "Sales Account", code: "4001", type: "REVENUE", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "purchase", name: "Purchase Account", code: "5001", type: "EXPENSE", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "rent", name: "Rent Paid", code: "5101", type: "EXPENSE", isGroup: false, openingBalance: 0, taxApplicable: false },
  { id: "salary", name: "Salary & Wages", code: "5102", type: "EXPENSE", isGroup: false, openingBalance: 0, taxApplicable: false },
];

export function accountMap(): Map<string, Account> {
  return new Map(TEST_ACCOUNTS.map((a) => [a.id, a]));
}

let seed = 1234567n;
function next(): number {
  // xorshift64 — deterministic per run so failures are reproducible.
  let x = seed;
  x ^= x << 13n;
  x ^= x >> 7n;
  x ^= x << 17n;
  seed = x;
  // Use the high bits; low bits of LCGs are weak.
  return Number((x >> 11n) % 1000000n) / 1000000;
}

export function resetSeed(s = 1234567n): void {
  seed = s;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(next() * arr.length)] as T;
}

/** A random non-negative integer amount in minor units, up to 10 crore taka. */
export function randomAmount(): number {
  return Math.floor(next() * 1_000_000_000);
}

/**
 * A random *balanced* transaction: split a random amount across n accounts,
 * keeping Σ debit == Σ credit exactly.
 *
 * The split is constructed balanced by design — the property under test is
 * that the engine preserves the invariant, not that it repairs bad input.
 * Malformed input is covered separately in post.test.ts.
 */
export function randomTransaction(id: string, day = 1): Transaction {
  const amount = randomAmount();
  const nLines = 2 + Math.floor(next() * 3); // 2–4 lines
  const debitIds: string[] = [];
  const creditIds: string[] = [];
  for (let i = 0; i < nLines; i++) {
    if (i % 2 === 0) debitIds.push(pick(TEST_ACCOUNTS).id);
    else creditIds.push(pick(TEST_ACCOUNTS).id);
  }

  // Partition the amount across each side independently, so both Σ debit and
  // Σ credit equal `amount` exactly regardless of how the lines split.
  const debitAmounts = partition(amount, debitIds.length);
  const creditAmounts = partition(amount, creditIds.length);

  const entries: JournalEntry[] = [];
  debitIds.forEach((accountId, i) => {
    const acc = TEST_ACCOUNTS.find((a) => a.id === accountId)!;
    entries.push({ accountId, accountType: acc.type, debit: debitAmounts[i]!, credit: 0 });
  });
  creditIds.forEach((accountId, i) => {
    const acc = TEST_ACCOUNTS.find((a) => a.id === accountId)!;
    entries.push({ accountId, accountType: acc.type, debit: 0, credit: creditAmounts[i]! });
  });

  const date = new Date(2026, 6, day); // 1 Jul 2026, BD fiscal year start

  return {
    id,
    date,
    narration: `generated ${id}`,
    entries,
    totalDebit: amount,
    totalCredit: amount,
    status: "draft",
    version: 1,
  };
}

/** Split n into `parts` non-negative integers summing exactly to n. */
function partition(n: number, parts: number): number[] {
  if (parts <= 1) return [n];
  const cuts: number[] = [];
  for (let i = 0; i < parts - 1; i++) cuts.push(Math.floor(next() * n));
  cuts.sort((a, b) => a - b);
  const out: number[] = [];
  let prev = 0;
  for (const c of cuts) {
    out.push(c - prev);
    prev = c;
  }
  out.push(n - prev);
  return out;
}

/**
 * A transaction that is deliberately balanced on paper but whose entry rows do
 * not sum to the stored totals — exactly the malformed case R4's recomputing
 * trigger must reject.
 */
export function unbalancedEntryTransaction(id: string): Transaction {
  const tx = randomTransaction(id);
  // Corrupt: entries say 500/500 but totals claim 500/600.
  return { ...tx, totalCredit: tx.totalDebit + 100 };
}

export { normalSide };
