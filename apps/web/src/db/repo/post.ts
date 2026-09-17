/**
 * Voucher repository — §15.1 R8, the atomic post path.
 *
 * The one place a voucher is written to the database. Sequence increment,
 * balance validation and the journal write are a single transaction, so a
 * failure anywhere leaves nothing behind: no consumed sequence number, no
 * header without lines, no partially posted voucher (R3, R4, R8).
 *
 * Balance is validated by the ledger engine before any write, and the DB
 * triggers are the last-resort check for anything that reaches the tables
 * another way.
 */
import { sql } from "drizzle-orm";
import { ledger, type Transaction } from "@neurobook/shared";
import {
  accounts,
  fiscalPeriods,
  voucherSequences,
  vouchers,
  voucherEntries,
} from "../schema/index.js";
import type { DbTransaction } from "../client.js";
import { ULID } from "../ulid.js";

/**
 * The voucher types the DB enum accepts. Mirrors `voucher_type` in the schema;
 * the enum object itself cannot be used as a value across a package boundary
 * under `verbatimModuleSyntax`.
 */
type VoucherType =
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

const { validateForPost, UNBALANCED } = ledger;

export interface PostInput {
  tenantId: string;
  userId: string;
  voucherType: VoucherType;
  date: Date;
  narration: string;
  /** §15.1 R6. A replay of the same key returns the original response. */
  idempotencyKey?: string;
  entries: ReadonlyArray<{
    accountId: string;
    debit: number;
    credit: number;
    reference?: string;
  }>;
}

export interface PostedVoucher {
  id: string;
  sequenceNumber: string;
  postedAt: Date;
}

/**
 * Increment the gapless sequence for this tenant/type/year and return it.
 *
 * A Postgres SEQUENCE is deliberately not used: a rolled-back transaction still
 * consumes one, which would break the gapless requirement. The row is locked
 * for the duration of the transaction, so concurrent posts in the same tenant
 * serialise rather than race (R3).
 */
async function nextSequence(
  tx: DbTransaction,
  tenantId: string,
  voucherType: VoucherType,
  date: Date,
): Promise<string> {
  const fiscalYear = date.getFullYear();

  // Lock the row if it exists, inside this transaction.
  const existing = await tx
    .select({ lastNumber: voucherSequences.lastNumber })
    .from(voucherSequences)
    .where(
      sql`${voucherSequences.tenantId} = ${tenantId}
          AND ${voucherSequences.voucherType} = ${voucherType}
          AND ${voucherSequences.fiscalYear} = ${fiscalYear}`,
    )
    .for("update");

  if (existing.length === 0) {
    // First voucher of this type in this fiscal year: create the counter row.
    await tx.insert(voucherSequences).values({
      id: ULID(),
      tenantId,
      voucherType,
      fiscalYear,
      lastNumber: 1,
    });
    return formatSequence(1);
  }

  const next = existing[0]!.lastNumber + 1;
  await tx
    .update(voucherSequences)
    .set({ lastNumber: next, updatedAt: new Date() })
    .where(
      sql`${voucherSequences.tenantId} = ${tenantId}
          AND ${voucherSequences.voucherType} = ${voucherType}
          AND ${voucherSequences.fiscalYear} = ${fiscalYear}`,
    );
  return formatSequence(next);
}

function formatSequence(n: number): string {
  // Fixed-width, zero-padded: the numbering must sort and be gapless for
  // Bangladesh Mushak/e-invoice compliance.
  return String(n).padStart(8, "0");
}

/**
 * Post a voucher atomically (R8).
 *
 * Throws LedgerError for any violation; the caller's transaction rolls back and
 * nothing is written.
 */
export async function postVoucher(
  tx: DbTransaction,
  input: PostInput,
): Promise<PostedVoucher> {
  // 1. Load the tenant's chart of accounts and fiscal periods, scoped by RLS.
  const [accountRows, periodRows] = await Promise.all([
    tx
      .select({
        id: accounts.id,
        name: accounts.name,
        code: accounts.code,
        type: accounts.type,
        isGroup: accounts.isGroup,
        openingBalance: accounts.openingBalance,
        taxApplicable: accounts.taxApplicable,
      })
      .from(accounts)
      .where(sql`${accounts.tenantId} = ${input.tenantId}`),
    tx
      .select({
        startDate: fiscalPeriods.startDate,
        endDate: fiscalPeriods.endDate,
        status: fiscalPeriods.status,
      })
      .from(fiscalPeriods)
      .where(sql`${fiscalPeriods.tenantId} = ${input.tenantId}`),
  ]);

  const accountsById = new Map(accountRows.map((a) => [a.id, a]));

  // 2. Validate against the pure engine. This is the authority: it catches an
  //    unbalanced pair, an unknown account, or a closed period before any write.
  //    The per-line account type is taken from the tenant's chart of accounts,
  //    not from client input, so a caller cannot post to an account under a
  //    type that is not its own.
  const engineTx = toTransaction(input, accountsById);
  validateForPost(engineTx, {
    accounts: accountsById,
    periods: periodRows,
  });

  const totalDebit = input.entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = input.entries.reduce((s, e) => s + e.credit, 0);
  if (totalDebit !== totalCredit) throw UNBALANCED;

  // 3. Reserve the sequence number inside this transaction (R3).
  const sequenceNumber = await nextSequence(tx, input.tenantId, input.voucherType, input.date);
  const id = ULID();
  const postedAt = new Date();

  // 4. Write the header, then its lines.
  await tx.insert(vouchers).values({
    id,
    tenantId: input.tenantId,
    sequenceNumber,
    voucherType: input.voucherType,
    date: input.date,
    narration: input.narration,
    status: "posted",
    totalDebit,
    totalCredit,
    idempotencyKey: input.idempotencyKey,
    version: 1,
    createdBy: input.userId,
    postedAt,
  });

  await tx.insert(voucherEntries).values(
    input.entries.map((e) => ({
      id: ULID(),
      tenantId: input.tenantId,
      voucherId: id,
      accountId: e.accountId,
      debit: e.debit,
      credit: e.credit,
      reference: e.reference,
    })),
  );

  return { id, sequenceNumber, postedAt };
}

/** The per-line account type the engine's Transaction expects. */
type AccountType = Transaction["entries"][number]["accountType"];

/**
 * Convert input into the engine's Transaction shape for validation.
 *
 * The engine's Transaction carries accountType per line, but the DB layer looks
 * accounts up by id rather than trusting a client-supplied type, so the type is
 * resolved from the tenant's chart of accounts here.
 */
function toTransaction(
  input: PostInput,
  accountsById: Map<string, { id: string; type: AccountType }>,
): Transaction {
  return {
    id: "pending",
    date: input.date,
    narration: input.narration,
    entries: input.entries.map((e) => {
      const found = accountsById.get(e.accountId);
      return {
        accountId: e.accountId,
        accountType: found ? found.type : ("ASSET" as const),
        debit: e.debit,
        credit: e.credit,
      };
    }),
    totalDebit: input.entries.reduce((s, e) => s + e.debit, 0),
    totalCredit: input.entries.reduce((s, e) => s + e.credit, 0),
    status: "draft",
    version: 1,
  };
}
