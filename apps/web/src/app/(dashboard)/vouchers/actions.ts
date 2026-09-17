"use server";

/**
 * Voucher mutations — §15.1 R6/R8.
 *
 * Tenant and user come from middleware headers, never the request body (§15.2 R10).
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createDb, withTenant, postVoucher } from "@/db/index.js";
export async function postVoucherAction(input: {
  voucherType: string;
  date: string;
  narration: string;
  idempotencyKey: string;
  entries: Array<{ accountId: string; debit: number; credit: number; reference?: string }>;
}): Promise<{ ok: true; id: string; sequenceNumber: string; postedAt: Date } | { ok: false; error: string }> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  const db = createDb();
  try {
    const result = await withTenant(db, tenantId, (tx) =>
      postVoucher(tx, {
        tenantId,
        userId,
        voucherType: input.voucherType as Parameters<typeof postVoucher>[1]["voucherType"],
        date: new Date(input.date),
        narration: input.narration,
        idempotencyKey: input.idempotencyKey,
        entries: input.entries,
      }),
    );
    revalidatePath("/dashboard/vouchers");
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "posting failed" };
  }
}
