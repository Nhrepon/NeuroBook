/**
 * Shared Zod schemas (§15.4 U8): one schema drives client errors, server
 * validation and the API contract.
 */
import { z } from "zod";
import { ACCOUNT_TYPES } from "./types.js";

/** Money is a non-negative integer of minor units. Rejected as UNBALANCED/malformed otherwise. */
const minorUnits = z.number().int().nonnegative().finite();

export const accountTypeSchema = z.enum(ACCOUNT_TYPES as unknown as [string, ...string[]]);

export const journalEntrySchema = z
  .object({
    accountId: z.string().min(1),
    accountType: accountTypeSchema,
    debit: minorUnits.default(0),
    credit: minorUnits.default(0),
    reference: z.string().trim().optional(),
  })
  .refine((e) => (e.debit > 0) !== (e.credit > 0), {
    // Exactly one of debit/credit may be non-zero. Both zero is not a posting.
    message: "exactly one of debit or credit must be non-zero",
    path: ["debit"],
  });

export const transactionSchema = z
  .object({
    id: z.string().min(1),
    date: z.coerce.date(),
    narration: z.string().trim().min(1),
    entries: z.array(journalEntrySchema).min(2, "a voucher needs at least two entries"),
    totalDebit: minorUnits,
    totalCredit: minorUnits,
    status: z.enum(["draft", "posted", "reversed"]),
    version: z.number().int().nonnegative().default(1),
    idempotencyKey: z.string().optional(),
    sequenceNumber: z.string().optional(),
    reversedById: z.string().optional(),
  })
  .refine((t) => t.totalDebit === t.totalCredit, {
    message: "UNBALANCED: totalDebit must equal totalCredit",
    path: ["totalCredit"],
  })
  .refine(
    (t) => t.entries.reduce((s, e) => s + e.debit, 0) === t.totalDebit,
    {
      message: "UNBALANCED: Σ entry debits must equal totalDebit",
      path: ["totalDebit"],
    },
  )
  .refine(
    (t) => t.entries.reduce((s, e) => s + e.credit, 0) === t.totalCredit,
    {
      message: "UNBALANCED: Σ entry credits must equal totalCredit",
      path: ["totalCredit"],
    },
  );

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  type: accountTypeSchema,
  parentId: z.string().optional(),
  isGroup: z.boolean().default(false),
  openingBalance: z.number(),
  taxApplicable: z.boolean().default(false),
  taxCategory: z.string().optional(),
  taxRate: minorUnits.optional(),
  taxExempt: z.boolean().optional(),
  taxDeductible: z.boolean().optional(),
  taxDeductibleRate: minorUnits.optional(),
  taxExemptRate: minorUnits.optional(),
  taxExemptReason: z.string().optional(),
  taxDeductibleReason: z.string().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;
export type AccountInput = z.infer<typeof accountSchema>;
