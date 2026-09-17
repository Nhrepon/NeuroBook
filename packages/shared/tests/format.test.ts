import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatLongDate,
  formatSignedTaka,
  formatTaka,
  parseBdDate,
} from "../src/index.js";

describe("bd formatting (§15.4 U3)", () => {
  it("groups by lakh/crore, not by thousand", () => {
    // 100000000 minor = 10,00,000 taka. Bangladesh groups in lakhs and crores:
    // the digit after the first three is grouped in pairs, so this reads
    // "ten lakh" and never "one million".
    expect(formatTaka(100_000_000)).toBe("10,00,000");
    expect(formatTaka(1_550_000)).toBe("15,500");
    expect(formatTaka(25_000)).toBe("250");
  });

  it("shows paisa only when there is a fractional taka", () => {
    // 15050 minor = 150.50 taka. A whole-taka figure shows no decimals, so a
    // report column of integers stays clean.
    expect(formatTaka(15_000)).toBe("150");
    expect(formatTaka(15_050)).toBe("150.50");
  });

  it("wraps negative balances in brackets, the accounting convention", () => {
    expect(formatSignedTaka(-50_000)).toBe("(500)");
    expect(formatSignedTaka(50_000)).toBe("500");
    expect(formatSignedTaka(0)).toBe("0");
  });

  it("formats dates dd/mm/yy", () => {
    expect(formatDate("2026-07-15")).toBe("15/07/26");
    expect(formatLongDate("2026-07-15")).toBe("15/07/2026");
  });

  it("round-trips a dd/mm/yy date back to ISO", () => {
    expect(parseBdDate("15/07/26")).toBe("2026-07-15");
    expect(parseBdDate("15/07/2026")).toBe("2026-07-15");
  });

  it("reads an ambiguous date as day-first", () => {
    // 07/15/26 has an impossible day for a month-first reading, so the parser
    // takes 15 as the day and 07 as the month rather than rejecting it. The
    // convention is unambiguous in practice; this pins what it does.
    expect(parseBdDate("07/15/26")).toBe("2027-03-07");
  });
});
