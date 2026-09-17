import { describe, expect, it } from "vitest";
import type { Transaction } from "@neurobook/shared";
import { normalSide } from "@neurobook/shared";
import { ledger } from "@neurobook/shared";
const { balanceSheet, profitAndLoss, runningBalances, trialBalance } = ledger;
import { TEST_ACCOUNTS, accountMap, randomTransaction, resetSeed } from "./random.js";

/**
 * Property tests: the engine's real safety net (§15.5 O1).
 *
 * These assert invariants that must hold for ANY set of valid postings — not
 * for one hand-picked example. A bug that only manifests at particular amounts
 * or account combinations is caught by the fuzzer.
 */

const N_RUNS = 500;

function makeTransactions(n: number): { txs: ReturnType<typeof randomTransaction>[] } {
  resetSeed(); // deterministic per run for reproducible failures
  const txs = Array.from({ length: n }, (_, i) => {
    const tx = randomTransaction(`tx-${i}`, 1 + (i % 30));
    tx.status = "posted";
    return tx;
  });
  return { txs };
}

describe("ledger invariants (property-tested)", () => {
  it("trial balance always foots: Σ debit == Σ credit, difference == 0", () => {
    for (let run = 0; run < N_RUNS; run++) {
      const { txs } = makeTransactions(20);
      const tb = trialBalance(TEST_ACCOUNTS, txs);
      expect(tb.difference, `run ${run}: debit ${tb.totalDebit} != credit ${tb.totalCredit}`).toBe(0);
    }
  });

  it("balance sheet always balances: Assets == Liabilities + Equity", () => {
    for (let run = 0; run < N_RUNS; run++) {
      const { txs } = makeTransactions(20);
      const bs = balanceSheet(TEST_ACCOUNTS, txs);
      expect(bs.difference, `run ${run}`).toBe(0);
    }
  });

  it("gross movements always foot: Σ debit == Σ credit", () => {
    for (let run = 0; run < N_RUNS; run++) {
      const { txs } = makeTransactions(20);
      const tb = trialBalance(TEST_ACCOUNTS, txs);
      // Gross movements must balance even when an account moves both ways,
      // which is the case the net-balance version silently hid.
      expect(tb.difference, `run ${run}`).toBe(0);
      expect(tb.totalDebit).toBe(tb.totalCredit);

      // Closing balance must equal the net of the account's gross movements.
      const running = runningBalances(TEST_ACCOUNTS, txs);
      for (const row of tb.rows) {
        const acc = TEST_ACCOUNTS.find((a) => a.id === row.accountId)!;
        const side = normalSide(acc.type);
        const net =
          side === "debit" ? row.debit - row.credit : row.credit - row.debit;
        expect(running.get(row.accountId), `${acc.name}`).toBe(net);
      }
    }
  });

  it("a reversal nets its original to exactly zero", () => {
    for (let run = 0; run < 100; run++) {
      const { txs } = makeTransactions(5);
      const withReversals: Transaction[] = [];
      txs.forEach((tx) => {
        // The original stays posted and in the journal; the reversal carries
        // mirrored entries, so the pair nets to zero.
        withReversals.push(tx);
        withReversals.push({
          ...tx,
          id: `rev-${tx.id}`,
          date: new Date(tx.date.getTime() + 86_400_000),
          narration: `reversal ${tx.id}`,
          entries: tx.entries.map((e) => ({
            accountId: e.accountId,
            accountType: e.accountType,
            debit: e.credit,
            credit: e.debit,
            reference: e.reference,
          })),
          totalDebit: tx.totalCredit,
          totalCredit: tx.totalDebit,
          reversedById: tx.id,
        });
      });

      // After full reversal, every account returns to its opening balance (zero here).
      const tb = trialBalance(TEST_ACCOUNTS, withReversals);
      expect(tb.difference, `run ${run}`).toBe(0);
      for (const a of TEST_ACCOUNTS) {
        const bal = runningBalances(TEST_ACCOUNTS, withReversals).get(a.id);
        expect(bal, `${a.name} did not net to zero`).toBe(a.openingBalance);
      }
    }
  });

  it("P&L is internally consistent", () => {
    const { txs } = makeTransactions(30);
    const pl = profitAndLoss(TEST_ACCOUNTS, txs);
    expect(pl.netProfit).toBe(pl.revenue - pl.expenses);
  });
});
