/**
 * Report generation — §4.3.
 *
 * Every report is derived from the same running balances via applyTransaction,
 * so the trial balance, P&L and balance sheet can never disagree with each
 * other or with the ledger. All arithmetic is integer minor units.
 */
import {
  type Account,
  type BalanceSheet,
  type ProfitAndLoss,
  type Transaction,
  type TrialBalance,
  normalSide,
} from "../index.js";
import { applyTransaction } from "./post.js";

export interface ReportOptions {
  /** Inclusive. Defaults to unbounded. */
  from?: Date;
  /** Inclusive. Defaults to unbounded. */
  to?: Date;
}

/**
 * Filter to journal transactions in [from, to]. Drafts are excluded — they are
 * not part of the books — but `reversed` vouchers are kept: their reversal
 * carries mirrored entries and the pair nets to zero, so dropping the original
 * would double-count.
 */
function inRange(txs: readonly Transaction[], opts: ReportOptions = {}): Transaction[] {
  return txs.filter((t) => {
    if (t.status === "draft") return false;
    if (opts.from && t.date < opts.from) return false;
    if (opts.to && t.date > opts.to) return false;
    return true;
  });
}

/**
 * Running balance per account, starting from opening balances.
 *
 * Opening balance is signed to the account's normal side, matching how
 * applyTransaction signs movement, so an opening debit on an asset account
 * adds correctly.
 */
export function runningBalances(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  opts: ReportOptions = {},
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const a of accounts) balances.set(a.id, a.openingBalance);
  for (const t of inRange(txs, opts)) applyTransaction(balances, t);
  return balances;
}

/**
 * Trial balance — Σ debits must equal Σ credits (§4.3, §15.5 O1).
 *
 * This reports GROSS movements per account (total debits posted, total credits
 * posted), not the net balance. Netting would silently hide activity — paying
 * off a creditor cancels the purchase on the same account — and a trial
 * balance that nets can never agree with the journal. The closing balance is
 * still carried alongside for display.
 *
 * `difference` must be zero; a non-zero difference means the books do not
 * foot and is a hard failure in CI.
 */
export function trialBalance(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  opts: ReportOptions = {},
): TrialBalance {
  const balances = runningBalances(accounts, txs, opts);

  // Gross debit/credit movements per account.
  const movements = new Map<string, { debit: number; credit: number }>();
  for (const t of inRange(txs, opts)) {
    for (const e of t.entries) {
      const m = movements.get(e.accountId) ?? { debit: 0, credit: 0 };
      m.debit += e.debit;
      m.credit += e.credit;
      movements.set(e.accountId, m);
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const rows = accounts
    .filter((a) => !a.isGroup)
    .map((a) => {
      const m = movements.get(a.id) ?? { debit: 0, credit: 0 };
      const signed = balances.get(a.id) ?? 0;
      totalDebit += m.debit;
      totalCredit += m.credit;
      return { accountId: a.id, debit: m.debit, credit: m.credit, balance: signed };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);

  return { rows, totalDebit, totalCredit, difference: totalDebit - totalCredit };
}

/**
 * Profit & loss for a period — revenue minus expenses (§4.3).
 *
 * Revenue is credit-normal so it is reported as a positive figure when the
 * account has a credit balance; expenses are debit-normal. netProfit is signed
 * toward credit, i.e. positive = profit.
 */
export function profitAndLoss(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  opts: ReportOptions = {},
): ProfitAndLoss {
  const balances = runningBalances(accounts, txs, opts);
  const rows = accounts.filter(
    (a) => !a.isGroup && (a.type === "REVENUE" || a.type === "EXPENSE"),
  );

  let revenue = 0;
  let expenses = 0;
  for (const a of rows) {
    const signed = balances.get(a.id) ?? 0;
    if (a.type === "REVENUE") revenue += signed > 0 ? signed : 0;
    else expenses += signed > 0 ? signed : 0;
  }

  return { revenue, expenses, netProfit: revenue - expenses, rows: [] };
}

/**
 * Balance sheet — the accounting identity is
 *
 *     Assets == Liabilities + Equity + RetainedEarnings
 *
 * (§4.3, §15.5 O1). Revenue and expense accounts are not balance-sheet
 * accounts, so the unclosed profit for the period is carried as the
 * retained-earnings line; without it the sheet cannot foot.
 *
 * `difference` must be zero. The identity holds exactly when every posted
 * transaction was balanced, because a balanced posting moves equal amounts on
 * both sides of the accounting equation; an unbalanced one would break it,
 * which is why R4 is enforced before any write.
 */
export function balanceSheet(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  opts: ReportOptions = {},
): BalanceSheet {
  const balances = runningBalances(accounts, txs, opts);

  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let retainedEarnings = 0;
  for (const a of accounts) {
    if (a.isGroup) continue;
    const signed = balances.get(a.id) ?? 0;
    if (a.type === "ASSET") assets += signed;
    else if (a.type === "LIABILITY") liabilities += signed;
    else if (a.type === "EQUITY") equity += signed;
    else if (a.type === "REVENUE") retainedEarnings += signed;
    else if (a.type === "EXPENSE") retainedEarnings -= signed;
  }

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings,
    difference: assets - (liabilities + equity + retainedEarnings),
  };
}
