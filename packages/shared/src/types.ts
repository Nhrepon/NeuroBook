/**
 * Core domain types. Mirror §4.1/§4.2 of NeuroBook.md.
 *
 * Money is always integer minor units — see money.ts and §15.1 R7.
 */

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE";

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;

/**
 * Which side of the ledger a normal balance sits on.
 *
 * Debit-normal: assets and expenses increase on debit.
 * Credit-normal: liabilities, equity and revenue increase on credit.
 */
export function normalSide(type: AccountType): "debit" | "credit" {
  return type === "ASSET" || type === "EXPENSE" ? "debit" : "credit";
}

export type VoucherType =
  | "PAYMENT"
  | "RECEIPT"
  | "JOURNAL"
  | "SALES"
  | "PURCHASE"
  | "DEBIT_NOTE"
  | "CREDIT_NOTE"
  | "CONTRA"
  | "REFUND"
  | "TRANSFER"
  | "STOCK_TRANSFER"
  | "ADJUSTMENT";

export type VoucherStatus = "draft" | "posted" | "reversed";

export interface Account {
  id: string;
  name: string;
  code: string;
  type: AccountType;
  parentId?: string;
  isGroup: boolean;
  /** Opening balance in minor units, signed to the account's normal side. */
  openingBalance: number;
  taxApplicable: boolean;
  taxCategory?: string;
  taxRate?: number;
  taxExempt?: boolean;
  taxDeductible?: boolean;
  taxDeductibleRate?: number;
  taxExemptRate?: number;
  taxExemptReason?: string;
  taxDeductibleReason?: string;
}

export interface JournalEntry {
  accountId: string;
  accountType: AccountType;
  /** Minor units, non-negative. Exactly one of debit/credit is non-zero. */
  debit: number;
  credit: number;
  /** Invoice, bill or payment reference. */
  reference?: string;
}

export interface Transaction {
  id: string;
  date: Date;
  narration: string;
  entries: JournalEntry[];
  /** Must equal Σ entries.debit, checked at post (§15.1 R4). */
  totalDebit: number;
  /** Must equal Σ entries.credit, checked at post (§15.1 R4). */
  totalCredit: number;
  status: VoucherStatus;
  /** Optimistic concurrency (§15.1 R5). */
  version: number;
  /** Safe retry (§15.1 R6). */
  idempotencyKey?: string;
  /** Gapless legal numbering, assigned at post (§15.1 R3). */
  sequenceNumber?: string;
  /** The voucher that reversed this one, if reversed (§15.1 R1). */
  reversedById?: string;
}

/** Signed balance of a single account: positive = normal side. */
export interface AccountBalance {
  accountId: string;
  debit: number;
  credit: number;
  /** Closing balance signed toward the account's normal side. */
  balance: number;
}

export interface TrialBalance {
  rows: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  /** Must be zero. If it is not, the books do not foot. */
  difference: number;
}

export interface ProfitAndLoss {
  revenue: number;
  expenses: number;
  /** revenue - expenses, signed toward the revenue normal side (credit). */
  netProfit: number;
  rows: AccountBalance[];
}

export interface BalanceSheet {
  assets: number;
  liabilities: number;
  /** Capital accounts only. */
  equity: number;
  /**
   * Unclosed profit for the period — revenue minus expenses.
   *
   * The accounting identity is `Assets == Liabilities + Equity + NetProfit`,
   * not `Assets == Liabilities + Equity`. Revenue and expense accounts are not
   * part of the balance sheet, so without this balancing figure the sheet can
   * never foot except at period close. This is the "Retained Earnings" line.
   */
  retainedEarnings: number;
  /** Must be zero: Assets == Liabilities + Equity + RetainedEarnings. */
  difference: number;
}
