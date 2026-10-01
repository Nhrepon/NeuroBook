'use client'

// U1: keyboard-first voucher entry. Enter = next field, Ctrl+Enter = save.
//
// 5.3: all twelve voucher types are offered, and each type narrows the account
// pickers to the accounts it may legally use - a CONTRA offers only cash/bank
// accounts, a sales invoice only REVENUE on the credit side. The rule is
// stated under the picker rather than enforced silently, so the accountant
// learns why an account is missing instead of discovering it on save.
import { useActionState, useMemo, useRef, useState } from 'react'
import { createVoucherAction } from '@/actions/voucher.actions'
import {
  VOUCHER_GROUP_ORDER,
  voucherTypeSpec,
  voucherTypesForEntry,
  partySideFor,
  allowedTypesFor,
  invoicePathFor,
} from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'
import { formatTakaFromMinor } from '@neurobook/shared/format'
import { Button } from './Button'
import {
  blankRow,
  parseMinor,
  formatMinorInput,
  totals,
  clientProblems,
  toEntries,
  type Row,
  type AccountOpt,
} from './voucherForm.model'

export function VoucherForm({
  accounts,
  initialType,
  initialDate,
}: {
  accounts: AccountOpt[]
  /** Pre-selected type, from the sidebar's voucher-type group (`?type=`). */
  initialType?: VoucherType
  /**
   * Today's date, passed in rather than read from the clock here.
   *
   * A server-rendered form whose default depends on `new Date()` mismatches on
   * hydration whenever the book is opened near midnight.
   */
  initialDate: string
}) {
  const [state, action, pending] = useActionState(createVoucherAction, {
    ok: false,
    errors: undefined,
  })
  /*
   * A document type is not offered here, so defaulting to one would leave the
   * <select> with a value it has no option for — it renders blank and every
   * picker's option list silently mismatches. Fall back to PAYMENT instead.
   */
  const entryType =
    initialType && voucherTypeSpec(initialType).entry === 'voucher' ? initialType : 'PAYMENT'

  const [type, setType] = useState<VoucherType>(entryType)
  const [date, setDate] = useState(initialDate)
  const [narration, setNarration] = useState('')
  const [rows, setRows] = useState<Row[]>([blankRow(1), blankRow(2)])

  const formRef = useRef<HTMLFormElement>(null)

  const spec = voucherTypeSpec(type)

  /**
   * §5.3: which side the customer/supplier control account belongs on, so the
   * accountant is told rather than having to remember that a payment DEBITS
   * the payable while a receipt CREDITS the receivable. `null` for the types
   * with no party side at all (journal, contra, transfer, stock, adjustment).
   */
  const partySide = partySideFor(type)
  const partyHint =
    partySide === null
      ? null
      : `Party control account: ${partySide === 'debit' ? 'debit' : 'credit'} side.`

  /**
   * Accounts allowed on one side. Falls back to the whole chart when the
   * chart has no account of the required type, so the picker is never empty -
   * an empty dropdown cannot be selected and tells the user nothing about why.
   */
  function accountsFor(side: 'debit' | 'credit'): AccountOpt[] {
    const allowed = allowedTypesFor(type, side)
    if (!allowed) return accounts
    const filtered = accounts.filter((a) => allowed.includes(a.type))
    return filtered.length > 0 ? filtered : accounts
  }

  const debitAccounts = useMemo(() => accountsFor('debit'), [accounts, type])
  const creditAccounts = useMemo(() => accountsFor('credit'), [accounts, type])

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((p) => [...p, blankRow(p.length + 1)])
  }

  function removeRow(key: number) {
    setRows((p) => (p.length > 1 ? p.filter((r) => r.key !== key) : p))
  }

  const entries = useMemo(() => toEntries(rows, accounts), [rows, accounts])
  const { debit: totalDebit, credit: totalCredit, difference } = useMemo(
    () => totals(rows, accounts),
    [rows, accounts],
  )

  /**
   * The same gate the submit button uses, so the button is never enabled while
   * the page says the voucher is not saveable. These are the server's own
   * validators - §5.3 rules included - run early so a rejection is decided at
   * entry time instead of the outcome of a round trip.
   */
  const problems = useMemo(
    () => clientProblems({ type, date, narration, rows, accounts }),
    [type, date, narration, rows, accounts],
  )
  const canSave = problems.length === 0 && !pending

  /**
   * U1. The header comment promised "Enter = next field" and only Ctrl+Enter
   * was ever wired up.
   *
   * Ctrl+Enter saves from anywhere in the form. Plain Enter advances to the next
   * field, because an accountant filling a voucher is walking a list of cells,
   * and a stray submit halfway through is how a half-typed draft gets saved.
   */
  function onKeyDown(ev: React.KeyboardEvent<HTMLFormElement>) {
    if (ev.key !== 'Enter') return

    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault()
      if (canSave) ev.currentTarget.requestSubmit()
      return
    }

    const target = ev.target as HTMLElement
    // Leave Enter alone where it already means something: multi-line narration,
    // a <select>'s space bar, and buttons.
    if (['TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return

    ev.preventDefault()
    moveFocus(ev.currentTarget, target, 1)
  }

  /**
   * Move focus `step` fields through the form.
   *
   * Reading the live DOM rather than keeping a parallel index means a row added
   * or removed between two keypresses cannot desynchronise the navigation - the
   * failure mode that makes keyboard entry worse than none.
   */
  function moveFocus(form: HTMLFormElement, from: HTMLElement, step: number) {
    const fields = Array.from(
      form.querySelectorAll<HTMLElement>('input:not([type=hidden]), select, textarea, button'),
    ).filter((el) => !(el as HTMLInputElement).disabled)
    const index = fields.indexOf(from)
    fields[index + step]?.focus()
  }

  const entriesJson = JSON.stringify(entries)

  return (
    <form ref={formRef} action={action} onKeyDown={onKeyDown} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block">Date</span>
          <input
            name="date"
            type="date"
            required
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            className="w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block">Voucher type</span>
          {/*
            Grouped optgroups, and document types absent entirely. They are
            owned by the invoice form — offering them here is how a sales
            invoice ends up as two bare account lines with no VAT split, no
            `invoices` row and no Mushak 6.2. `?type=SALES_INVOICE` still lands
            correctly: the page redirects rather than silently showing a form
            that cannot produce the document.
          */}
          <select
            name="voucherType"
            required
            value={type}
            onChange={(ev) => setType(ev.target.value as VoucherType)}
            className="w-full rounded border px-2 py-1.5"
          >
            {VOUCHER_GROUP_ORDER.filter((g) => g.group !== 'document').map((g) => {
              const types = voucherTypesForEntry('voucher').filter((t) => {
                const s = voucherTypeSpec(t)
                return s.group === g.group
              })
              if (types.length === 0) return null
              return (
                <optgroup key={g.group} label={g.label}>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {voucherTypeSpec(t).label}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
            {spec.rule}
            {partyHint && <span className="mt-1 block"> {partyHint}</span>}
          </span>
          {/*
            The visible way back to the document types, rather than expecting
            anyone to remember they moved.
          */}
          <a href="/invoices/new" className="mt-1 inline-block text-xs underline">
            Sales or purchase document? Use the invoice form.
          </a>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block">Narration</span>
        <input
          name="narration"
          required
          maxLength={500}
          value={narration}
          onChange={(ev) => setNarration(ev.target.value)}
          className="w-full rounded border px-2 py-1.5"
        />
      </label>

      <input type="hidden" name="entries" value={entriesJson} />

      <div>
        <h3 className="mb-2 text-sm font-semibold">Journal lines</h3>
        {/* overflow-x-auto: six columns do not fit a phone, and the outer page
            scrolls horizontally, which strands the credit column off-screen. */}
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Debit and credit account lines for this voucher, in taka
            </caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="px-2 py-1">Debit account</th>
                <th scope="col" className="px-2 py-1 text-right">Debit</th>
                <th scope="col" className="px-2 py-1">Credit account</th>
                <th scope="col" className="px-2 py-1 text-right">Credit</th>
                <th scope="col" className="px-2 py-1"><span className="sr-only">Remove line</span></th>
              </tr>
            </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="py-1 pr-2">
                  <select
                    value={r.debitAccountId}
                    onChange={(ev) => updateRow(r.key, { debitAccountId: ev.target.value })}
                    className="w-full rounded border px-2 py-1"
                  >
                    <option value="">Choose...</option>
                    {debitAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2 text-right">
                  {/*
                    Text + inputMode, not type="number". A controlled
                    type="number" rounds on every keystroke, so typing "12."
                    snaps the value back to "12" and the decimal point can never
                    be entered - "12.50" is unreachable. `parseMinor` turns the
                    text back into minor units at the boundary.
                  */}
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={r.debitText}
                    aria-label={`Debit amount, line ${r.key}`}
                    onChange={(ev) => updateRow(r.key, { debitText: ev.target.value })}
                    onBlur={(ev) =>
                      updateRow(r.key, {
                        debitText: ev.target.value ? formatMinorInput(parseMinor(ev.target.value)) : '',
                      })
                    }
                    className="w-28 rounded border px-2 py-1 text-right tabular-nums"
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    value={r.creditAccountId}
                    onChange={(ev) => updateRow(r.key, { creditAccountId: ev.target.value })}
                    className="w-full rounded border px-2 py-1"
                  >
                    <option value="">Choose...</option>
                    {creditAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={r.creditText}
                    aria-label={`Credit amount, line ${r.key}`}
                    onChange={(ev) => updateRow(r.key, { creditText: ev.target.value })}
                    onBlur={(ev) =>
                      updateRow(r.key, {
                        creditText: ev.target.value ? formatMinorInput(parseMinor(ev.target.value)) : '',
                      })
                    }
                    className="w-28 rounded border px-2 py-1 text-right tabular-nums"
                  />
                </td>
                <td className="py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeRow(r.key)}
                    aria-label={`Remove line ${r.key}`}
                    disabled={rows.length <= 1}
                  >
                    x
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="py-2" />
              <td className="py-2 text-right">{formatTakaFromMinor(totalDebit)}</td>
              <td className="py-2" />
              <td className="py-2 text-right">{formatTakaFromMinor(totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={addRow}>
            + Add line
          </Button>
          {/* aria-live: the balance flips as the user types, and a screen reader
              user is otherwise told nothing about it. */}
          <span
            aria-live="polite"
            className={
              difference === 0
                ? 'text-xs text-[hsl(var(--muted-foreground))]'
                : 'text-xs font-medium text-red-600'
            }
          >
            {difference === 0
              ? 'Balanced'
              : `Out of balance by ${formatTakaFromMinor(Math.abs(difference))}`}
          </span>
        </div>
      </div>

      {/*
        The blocking problems, listed in the order they should be fixed. This is
        the whole point of running the server's validators client-side: the
        answer arrives while the cursor is still in the row, and the submit
        button's state is explained rather than merely greyed out.
      */}
      {problems.length > 0 && (
        <div
          role="status"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
        >
          <p className="font-medium">
            {problems.length === 1 ? 'One thing to fix' : `${problems.length} things to fix`}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* role="alert" so a rejection is announced; focus moves here on a failed
          save so the keyboard and screen-reader user lands on the reason. */}
      <div ref={(el) => el?.focus()} tabIndex={-1} role="alert" className="outline-none">
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        {state.errors && (
          <ul className="text-sm text-red-600">
            {Object.entries(state.errors).map(([k, v]) => (
              <li key={k}>
                {k}: {(v as string[]).join(', ')}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Disabled on the real problem list, not just `pending`: the button
            said "Save" on an empty form and the user learned the rules only
            from the response. */}
        <Button type="submit" disabled={!canSave}>
          {pending ? 'Saving…' : 'Save draft (Ctrl+Enter)'}
        </Button>
        {problems.length > 0 && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            Fix the {problems.length === 1 ? 'point' : 'points'} above to save.
          </span>
        )}
      </div>
    </form>
  )
}
