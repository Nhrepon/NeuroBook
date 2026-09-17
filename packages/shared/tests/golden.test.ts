/**
 * Golden ledger fixture — §15.5 O1.
 *
 * Unlike the property tests, this uses a fixed, human-auditable set of books
 * with hardcoded expected numbers. If anyone changes the engine or the
 * rounding and the outputs drift, this fails with a number you can eyeball
 * and verify against the entries by hand.
 *
 * The books: a sole-trader retail business in its first month.
 */
import { describe, expect, it } from "vitest";
import { ledger } from "@neurobook/shared";
const { balanceSheet, profitAndLoss, trialBalance } = ledger;
import type { Account, Transaction } from "@neurobook/shared";

const FY_START = new Date(2026, 6, 1); // 1 Jul 2026

const accounts: Account[] = [
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

const t = (
  id: string,
  day: number,
  narration: string,
  entries: Array<[accountId: string, debit: number, credit: number]>,
): Transaction => {
  const rows = entries.map(([accountId, debit, credit]) => {
    const acc = accounts.find((a) => a.id === accountId)!;
    return { accountId, accountType: acc.type, debit, credit };
  });
  const totalDebit = rows.reduce((s, e) => s + e.debit, 0);
  const totalCredit = rows.reduce((s, e) => s + e.credit, 0);
  return {
    id,
    date: new Date(FY_START.getFullYear(), FY_START.getMonth(), day),
    narration,
    entries: rows,
    totalDebit,
    totalCredit,
    status: "posted",
    version: 1,
  };
};

const transactions: Transaction[] = [
  // Owner injects capital: 10,00,000 taka into the bank.
  t("g1", 1, "Capital introduced by owner", [["bank", 100000000, 0], ["capital", 0, 100000000]]),
  // Rent deposit + first month: 50,000 cash, 20,000 bank.
  t("g2", 2, "Office rent paid", [["rent", 70000, 0], ["cash", 0, 50000], ["bank", 0, 20000]]),
  // Stock purchase on credit: 5,00,000.
  t("g3", 3, "Goods purchased on credit", [["inventory", 500000, 0], ["ap", 0, 500000]]),
  // Cash sale: 1,50,000.
  t("g4", 5, "Cash sales", [["cash", 150000, 0], ["sales", 0, 150000]]),
  // Credit sale: 2,00,000.
  t("g5", 8, "Credit sales", [["ar", 200000, 0], ["sales", 0, 200000]]),
  // Pay creditor 4,00,000 from bank.
  t("g6", 10, "Payment to creditor", [["ap", 400000, 0], ["bank", 0, 400000]]),
  // Salary paid: 1,20,000 bank + 30,000 cash.
  t("g7", 28, "Salary paid for the month", [["salary", 150000, 0], ["bank", 0, 120000], ["cash", 0, 30000]]),
  // Collect 1,00,000 from a debtor.
  t("g8", 29, "Receipt from debtor", [["bank", 100000, 0], ["ar", 0, 100000]]),
];

describe("golden ledger (§15.5 O1) — hardcoded expected values", () => {
  it("trial balance foots to zero with the expected totals", () => {
    const tb = trialBalance(accounts, transactions);
    expect(tb.difference).toBe(0);
    // Σ debit == Σ credit == the sum of every posted line. Derived from the
    // transactions themselves rather than hand-summed, so it cannot drift.
    const expectedTotal = transactions.reduce(
      (s, tx) => s + tx.totalDebit,
      0,
    );
    expect(tb.totalDebit).toBe(expectedTotal);
    expect(tb.totalCredit).toBe(expectedTotal);
  });

  it("reports the expected per-account balances", () => {
    const tb = trialBalance(accounts, transactions);
    const byAccount = new Map(tb.rows.map((r) => [r.accountId, r.balance]));

    // bank: 100000000 (capital) - 20000 (rent) - 400000 (creditor) - 120000 (salary) + 100000 (receipt)
    expect(byAccount.get("bank")).toBe(99560000);
    // cash: 150000 (cash sale) - 50000 (rent) - 30000 (salary)
    expect(byAccount.get("cash")).toBe(70000);
    // ar: 200000 - 100000 = 100000
    expect(byAccount.get("ar")).toBe(100000);
    // inventory 500000, ap 500000 - 400000 = 100000 (liability, credit-normal, positive)
    expect(byAccount.get("inventory")).toBe(500000);
    expect(byAccount.get("ap")).toBe(100000);
    // capital 100000000
    expect(byAccount.get("capital")).toBe(100000000);
    // sales: revenue is credit-normal, and a credit balance is positive.
    expect(byAccount.get("sales")).toBe(350000);
    // rent 70000, salary 150000
    expect(byAccount.get("rent")).toBe(70000);
    expect(byAccount.get("salary")).toBe(150000);
  });

  it("balance sheet balances: Assets == Liabilities + Equity + RetainedEarnings", () => {
    const bs = balanceSheet(accounts, transactions);
    expect(bs.difference).toBe(0);
    // Assets = bank 99560000 + cash 70000 + ar 100000 + inventory 500000 = 100230000
    expect(bs.assets).toBe(100230000);
    // Liabilities = ap 100000
    expect(bs.liabilities).toBe(100000);
    // Equity = capital 100000000
    expect(bs.equity).toBe(100000000);
    // Retained earnings = sales 350000 - (rent 70000 + salary 150000) = 130000
    expect(bs.retainedEarnings).toBe(130000);
  });

  it("P&L shows the expected profit", () => {
    const pl = profitAndLoss(accounts, transactions);
    expect(pl.revenue).toBe(350000);
    expect(pl.expenses).toBe(220000); // rent 70000 + salary 150000
    expect(pl.netProfit).toBe(130000);
  });

  it("ignores non-posted vouchers", () => {
    const withDraft = [...transactions];
    const draft = t("g9", 30, "not yet posted", [["cash", 99999999, 0], ["sales", 0, 99999999]]);
    draft.status = "draft";
    withDraft.push(draft);

    expect(trialBalance(accounts, withDraft).totalDebit).toBe(
      trialBalance(accounts, transactions).totalDebit,
    );
  });
});
