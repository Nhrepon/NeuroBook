/**
 * Keyboard-first voucher entry (§15.4 U1).
 *
 * The single biggest UX reason users tolerate Tally's interface is that a
 * voucher can be entered without touching the mouse. This hook owns that
 * behaviour: Enter moves to the next field, `Ctrl/Cmd+Enter` submits, and after
 * a successful save focus returns to the first field of a fresh voucher so the
 * next entry can begin immediately.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface EntryRow {
  accountId: string;
  debit: number;
  credit: number;
}

export interface VoucherDraft {
  voucherType: string;
  date: string;
  narration: string;
  entries: EntryRow[];
}

const EMPTY_ENTRY: EntryRow = { accountId: "", debit: 0, credit: 0 };

function newRow(): EntryRow {
  return { ...EMPTY_ENTRY };
}

/**
 * Manage a voucher form's rows and the focus chain between them.
 *
 * Focus is tracked by index, not by id, so a row can be inserted or removed and
 * the remaining positions still resolve. The refs array is keyed the same way.
 */
export function useVoucherEntry(initial?: Partial<VoucherDraft>) {
  const [draft, setDraft] = useState<VoucherDraft>(() => ({
    voucherType: initial?.voucherType ?? "JOURNAL",
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    narration: initial?.narration ?? "",
    entries: initial?.entries ?? [newRow(), newRow()],
  }));
  const [focusIndex, setFocusIndex] = useState(0);

  const refs = useRef<Array<Record<string, HTMLInputElement | null>>>([]);

  const setField = useCallback(
    <K extends keyof VoucherDraft>(key: K, value: VoucherDraft[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
    },
    [],
  );

  const setEntry = useCallback(
    (index: number, patch: Partial<EntryRow>) => {
      setDraft((d) => {
        const entries = d.entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
        return { ...d, entries };
      });
    },
    [],
  );

  const addRow = useCallback(() => {
    setDraft((d) => ({ ...d, entries: [...d.entries, newRow()] }));
  }, []);

  const removeRow = useCallback((index: number) => {
    setDraft((d) => {
      // A voucher needs at least two lines (§15.1 R4), so the last two stay.
      if (d.entries.length <= 2) return d;
      return { ...d, entries: d.entries.filter((_, i) => i !== index) };
    });
  }, []);

  /**
   * Move focus to the named field of a row, creating the ref slot if the row
   * has not rendered one yet.
   */
  const focusField = useCallback(
    (index: number, field: "accountId" | "debit" | "credit") => {
      const row = refs.current[index];
      if (row && row[field]) {
        row[field]?.focus();
        row[field]?.select?.();
        setFocusIndex(index);
      }
    },
    [],
  );

  /**
   * The next field in entry order. Account, then the amount side the row is
   * filling: a row being debited moves to its debit field, a credited row to
   * its credit field.
   */
  const nextField = useCallback(
    (index: number, from: "accountId" | "debit" | "credit") => {
      const row = refs.current[index];
      if (!row) return;
      const order: Array<"accountId" | "debit" | "credit"> =
        from === "accountId" ? ["accountId", "debit"] : [from];
      const at = order.indexOf(from);
      const nextInRow = order[at + 1];
      if (nextInRow) {
        focusField(index, nextInRow);
        return;
      }
      // End of this row: the next row's account, or a fresh row if this was last.
      const nextIndex = index + 1;
      if (nextIndex >= refs.current.length) {
        setDraft((d) => ({ ...d, entries: [...d.entries, newRow()] }));
        // Focus after the new row renders.
        requestAnimationFrame(() => focusField(nextIndex, "accountId"));
        return;
      }
      focusField(nextIndex, "accountId");
    },
    [focusField],
  );

  /**
   * Reset to a blank voucher and focus its first field, so one save flows into
   * the next entry without a mouse trip (U1).
   */
  const resetForNext = useCallback(() => {
    setDraft((d) => ({
      ...d,
      narration: "",
      entries: [newRow(), newRow()],
    }));
    setFocusIndex(0);
    requestAnimationFrame(() => focusField(0, "accountId"));
  }, [focusField]);

  /**
   * Global shortcuts. `Ctrl/Cmd+Enter` submits from anywhere in the form;
   * `Escape` cancels; `Alt+N` starts a fresh voucher.
   */
  const onKey = useCallback(
    (event: KeyboardEvent, onSubmit?: () => void, onCancel?: () => void) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSubmit?.();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.altKey && (event.key === "n" || event.key === "N")) {
        event.preventDefault();
        resetForNext();
      }
    },
    [resetForNext],
  );

  // Refs grow with the row count; stale slots are dropped on render.
  useEffect(() => {
    refs.current = refs.current.slice(0, draft.entries.length);
  }, [draft.entries.length]);

  return {
    draft,
    focusIndex,
    refs,
    setField,
    setEntry,
    addRow,
    removeRow,
    nextField,
    focusField,
    resetForNext,
    onKey,
  };
}
