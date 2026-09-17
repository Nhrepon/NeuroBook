"use server";

/**
 * Voucher mutations (§15.1).
 *
 * Every write goes through `postVoucher` in one transaction, so idempotency,
 * sequence numbering and the balance check are enforced in one place for both
 * the server actions and the REST route handlers (§6).
 *
 * The tenant and user come from middleware headers, never from the request
 * body: a client cannot choose a tenant to write into (§15.2 R10).
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createDb, withTenant, postVoucher } from "@/db/index.js";
import { transactionSchema } from "@neurobook/shared";

/** Read the tenant scope set by middleware from the verified token. */
async function scope() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) {
    throw new Error("unauthorized: no tenant scope on the request");
  }
  return { tenantId, userId };
}

export async function postVoucherAction(input: {
  voucherType: string;
  date: string;
  narration: string;
  idempotencyKey: string;
  entries: Array<{ accountId: string; debit: number; credit: number; reference?: string }>;
}) {
  const { tenantId, userId } = await scope();

  // Validate the input shape before touching the database. The shared schema is
  // the single authority, so a client-side error and a server-side rejection
  // read identically (§15.4 U8).
  const parsed = transactionSchema.safeParse({
    id: "pending",
    date: input.date,
    narration: input.narration,
    entries: input.entries,
    totalDebit: input.entries.reduce((s, e) => s + e.debit, 0),
    totalCredit: input.entries.reduce((s, e) => s + e.credit, 0),
    status: "draft",
    version: 1,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "invalid voucher" };
  }

  const db = createDb();
  try {
    const result = await withTenant(db, tenantId, (tx) =>
      postVoucher(tx, {
        tenantId,
        userId,
        voucherType: input.voucherType as never,
        date: new Date(input.date),
        narration: input.narration,
        idempotencyKey: input.idempotencyKey,
        entries: input.entries,
      }),
    );
    revalidatePath("/dashboard/vouchers");
    return { ok: true as const, ...result };
  } catch (error) {
    // A LedgerError carries a user-readable message; anything else is a bug,
    // and surfacing its text to the client would leak internals.
    const message = error instanceof Error ? error.message : "posting failed";
    return { ok: false as const, error: message };
  }
}
