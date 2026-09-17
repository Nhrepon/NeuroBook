"use client";

/**
 * Voucher entry (§15.4 U1).
 *
 * Keyboard-first: Enter moves to the next field, Ctrl+Enter posts, Escape
 * cancels, Alt+N starts a fresh voucher. After a successful post focus returns
 * to the first field so the next entry begins without reaching for the mouse —
 * the reason users tolerate Tally's interface, and the reason this page exists.
 */
import { useState, useTransition } from "react";
import { useVoucherEntry } from "./useVoucherEntry";
import { postVoucherAction } from "./actions";
import { formatTaka } from "@neurobook/shared";

const VOUCHER_TYPES = [
  "PAYMENT",
  "RECEIPT",
  "JOURNAL",
  "SALES",
  "PURCHASE",
  "DEBIT_NOTE",
  "CREDIT_NOTE",
  "CONTRA",
  "REFUND",
  "TRANSFER",
  "STOCK_TRANSFER",
  "ADJUSTMENT",
] as const;

export default function VoucherEntryPage() {
  const {
    draft,
    refs,
    setField,
    setEntry,
    addRow,
    removeRow,
    nextField,
    resetForNext,
    onKey,
  } = useVoucherEntry();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastPosted, setLastPosted] = useState<string | null>(null);

  const totalDebit = draft.entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = draft.entries.reduce((s, e) => s + e.credit, 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function submit() {
    if (!balanced) {
      setError("Debits must equal credits, with at least one non-zero entry.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await postVoucherAction({
        voucherType: draft.voucherType,
        date: draft.date,
        narration: draft.narration,
        // A client-generated key makes a network retry safe: the server
        // replays the original response rather than posting twice (§15.1 R6).
        idempotencyKey: crypto.randomUUID(),
        entries: draft.entries,
      });
      if (result.ok) {
        setLastPosted(result.sequenceNumber);
        resetForNext();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <h1>New Voucher</h1>

      {error ? (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      ) : null}

      {lastPosted ? (
        <p style={{ opacity: 0.7 }}>
          Posted {lastPosted}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "1rem", maxWidth: "52rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label>
            Type
            <select
              value={draft.voucherType}
              onChange={(e) => setField("voucherType", e.target.value)}
            >
              {VOUCHER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setField("date", e.target.value)}
            />
          </label>
        </div>

        <label>
          Narration
          <input
            value={draft.narration}
            onChange={(e) => setField("narration", e.target.value)}
            onKeyDown={(e) =>
              onKey(e, submit, () => setField("narration", ""))
            }
            placeholder="What is this voucher for?"
          />
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
            {draft.entries.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    ref={(el) => {
                      refs.current[index] = refs.current[index] ?? {};
                      refs.current[index]!.accountId = el;
                    }}
                    value={row.accountId}
                    onChange={(e) => setEntry(index, { accountId: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        nextField(index, "accountId");
                      } else {
                        onKey(e, submit);
                      }
                    }}
                    placeholder="Account code or name"
                  />
                </td>
                <td>
                  <input
                    ref={(el) => {
                      refs.current[index] = refs.current[index] ?? {};
                      refs.current[index]!.debit = el;
                    }}
                    type="number"
                    min={0}
                    value={row.debit || ""}
                    onChange={(e) =>
                      setEntry(index, { debit: Number(e.target.value) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        nextField(index, "debit");
                      } else {
                        onKey(e, submit);
                      }
                    }}
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <input
                    ref={(el) => {
                      refs.current[index] = refs.current[index] ?? {};
                      refs.current[index]!.credit = el;
                    }}
                    type="number"
                    min={0}
                    value={row.credit || ""}
                    onChange={(e) =>
                      setEntry(index, { credit: Number(e.target.value) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        nextField(index, "credit");
                      } else {
                        onKey(e, submit);
                      }
                    }}
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <input
                    value={row.reference ?? ""}
                    onChange={(e) =>
                      setEntry(index, { reference: e.target.value })
                    }
                    placeholder="Invoice #, bill ref…"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={draft.entries.length <= 2}
                    aria-label="Remove row"
                  >
                    −
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Totals</th>
              <th style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatTaka(totalDebit)}
              </th>
              <th style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatTaka(totalCredit)}
              </th>
              <th colSpan={2}>
                {balanced ? (
                  <span style={{ opacity: 0.7 }}>balanced</span>
                ) : (
                  <span style={{ color: "red" }}>not balanced</span>
                )}
              </th>
            </tr>
          </tfoot>
        </table>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button type="button" onClick={addRow}>
            + Add row
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !balanced}
          >
            {pending ? "Posting…" : "Post (Ctrl+Enter)"}
          </button>
        </div>

        <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Enter moves to the next field. Ctrl+Enter posts. Alt+N clears for the next
          entry. Escape clears the narration.
        </p>
      </div>
    </div>
  );
}
