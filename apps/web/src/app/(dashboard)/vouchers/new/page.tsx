"use client";

/**
 * New voucher entry page (§15.4 U1).
 *
 * Keyboard-first: Enter = next field, Ctrl+Enter = post, Alt+N = clear for the next entry,
 * Escape = cancel. After a post the form resets and focus returns to the first field,
 * so one entry flows into the next without reaching for the mouse.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useVoucherEntry } from "../useVoucherEntry";
import { postVoucherAction } from "../actions";
import { formatTaka } from "@neurobook/shared";

const TYPES = [
  "PAYMENT", "RECEIPT", "JOURNAL", "SALES", "PURCHASE",
  "DEBIT_NOTE", "CREDIT_NOTE", "CONTRA", "REFUND", "TRANSFER",
  "STOCK_TRANSFER", "ADJUSTMENT",
] as const;

export default function NewVoucherPage() {
  const {
    draft, refs, setField, setEntry,
    addRow, removeRow, nextField, resetForNext, onKey,
  } = useVoucherEntry();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastSeq, setLastSeq] = useState<string | null>(null);

  const debit  = draft.entries.reduce((s, e) => s + e.debit, 0);
  const credit = draft.entries.reduce((s, e) => s + e.credit, 0);
  const balanced = debit === credit && debit > 0;

  function submit() {
    if (!balanced) { setError("Debits must equal credits with at least one non-zero entry."); return; }
    setError(null);
    startTransition(async () => {
      const result = await postVoucherAction({
        voucherType: draft.voucherType,
        date: draft.date,
        narration: draft.narration,
        idempotencyKey: crypto.randomUUID(),
        entries: draft.entries,
      });
      if (result.ok) {
        setLastSeq(result.sequenceNumber);
        resetForNext();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h1>New Voucher</h1>
        <Link href="/dashboard/vouchers">← List</Link>
      </div>

      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
      {lastSeq && <p style={{ opacity: 0.7 }}>Posted {lastSeq}</p>}

      <div style={{ display: "grid", gap: "1rem", maxWidth: "52rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Type
            <select value={draft.voucherType} onChange={(e) => setField("voucherType", e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Date
            <input type="date" value={draft.date}
              onChange={(e) => setField("date", e.target.value)} />
          </label>
        </div>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          Narration
          <input value={draft.narration} placeholder="What is this voucher for?"
            onChange={(e) => setField("narration", e.target.value)}
            onKeyDown={(e) => onKey(e, submit, () => setField("narration", ""))} />
        </label>

        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th style={{ textAlign: "right" }}>Debit</th>
              <th style={{ textAlign: "right" }}>Credit</th>
              <th>Reference</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.entries.map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    ref={(el) => { refs.current[i] = { ...(refs.current[i] ?? {}), accountId: el }; }}
                    value={row.accountId}
                    placeholder="Account code or name"
                    onChange={(e) => setEntry(i, { accountId: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); nextField(i, "accountId"); }
                      else onKey(e, submit);
                    }}
                  />
                </td>
                <td>
                  <input
                    ref={(el) => { refs.current[i] = { ...(refs.current[i] ?? {}), debit: el }; }}
                    type="number" min={0}
                    value={row.debit || ""}
                    style={{ textAlign: "right" }}
                    onChange={(e) => setEntry(i, { debit: Number(e.target.value) })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); nextField(i, "debit"); }
                      else onKey(e, submit);
                    }}
                  />
                </td>
                <td>
                  <input
                    ref={(el) => { refs.current[i] = { ...(refs.current[i] ?? {}), credit: el }; }}
                    type="number" min={0}
                    value={row.credit || ""}
                    style={{ textAlign: "right" }}
                    onChange={(e) => setEntry(i, { credit: Number(e.target.value) })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); nextField(i, "credit"); }
                      else onKey(e, submit);
                    }}
                  />
                </td>
                <td>
                  <input
                    value={row.reference ?? ""}
                    placeholder="Invoice #, ref…"
                    onChange={(e) => setEntry(i, { reference: e.target.value })}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeRow(i)}
                    disabled={draft.entries.length <= 2} aria-label="Remove row">−</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Totals</th>
              <th style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatTaka(debit)}
              </th>
              <th style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatTaka(credit)}
              </th>
              <th colSpan={2}>
                {balanced
                  ? <span style={{ opacity: 0.7 }}>balanced ✓</span>
                  : <span style={{ color: "red" }}>not balanced</span>}
              </th>
            </tr>
          </tfoot>
        </table>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button type="button" onClick={addRow}>+ Add row</button>
          <button type="button" onClick={submit} disabled={pending || !balanced}>
            {pending ? "Posting…" : "Post (Ctrl+Enter)"}
          </button>
        </div>

        <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Enter = next field. Ctrl+Enter = post. Alt+N = clear. Escape = cancel narration.
        </p>
      </div>
    </div>
  );
}
