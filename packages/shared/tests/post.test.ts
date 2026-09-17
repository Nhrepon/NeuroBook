import { describe, expect, it } from "vitest";
import { ledger } from "@neurobook/shared";
const { LedgerError, buildReversal, validateForEdit, validateForPost } = ledger;
import { accountMap, randomTransaction, unbalancedEntryTransaction } from "./random.js";

describe("post (§15.1 R1–R8)", () => {
  it("accepts a balanced voucher", () => {
    const tx = randomTransaction("t1");
    expect(() => validateForPost(tx, { accounts: accountMap() })).not.toThrow();
  });

  it("rejects a voucher whose entry rows disagree with totals (R4)", () => {
    const tx = unbalancedEntryTransaction("t2");
    // The schema catches it as UNBALANCED before any business rule runs.
    expect(() => validateForPost(tx, { accounts: accountMap() })).toThrow(LedgerError);
  });

  it("rejects an entry referencing a foreign account (R9/R10)", () => {
    const tx = randomTransaction("t3");
    tx.entries[0]!.accountId = "another-tenant-account";
    expect(() => validateForPost(tx, { accounts: accountMap() })).toThrow(LedgerError);
  });

  it("rejects posting into a closed period (R2)", () => {
    const tx = randomTransaction("t4");
    const periods = [
      { startDate: new Date(2026, 6, 1), endDate: new Date(2027, 5, 30), status: "closed" as const },
    ];
    expect(() => validateForPost(tx, { accounts: accountMap(), periods })).toThrowError(
      /closed/i,
    );
  });

  it("refuses to edit a posted voucher (R1)", () => {
    const tx = randomTransaction("t5");
    tx.status = "posted";
    expect(() => validateForEdit(tx)).toThrowError(/immutable/i);
  });

  it("refuses to edit an already-reversed voucher (R1)", () => {
    const tx = randomTransaction("t6");
    tx.status = "reversed";
    expect(() => validateForEdit(tx)).toThrowError(/reversed/i);
  });

  it("builds a reversal that exactly mirrors the original (R1)", () => {
    const tx = randomTransaction("t7");
    tx.status = "posted";
    const reversal = buildReversal(tx, "rev-t7");

    expect(reversal.status).toBe("draft");
    expect(reversal.totalDebit).toBe(tx.totalCredit);
    expect(reversal.totalCredit).toBe(tx.totalDebit);
    expect(reversal.entries).toHaveLength(tx.entries.length);
    reversal.entries.forEach((e, i) => {
      expect(e.debit).toBe(tx.entries[i]!.credit);
      expect(e.credit).toBe(tx.entries[i]!.debit);
    });
    expect(reversal.reversedById).toBe(tx.id);
  });

  it("refuses to reverse a draft (R1)", () => {
    const tx = randomTransaction("t8");
    expect(() => buildReversal(tx, "rev-t8")).toThrowError(/posted/);
  });
});
