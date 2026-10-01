'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  VOUCHER_GROUP_ORDER,
  voucherTypeSpec,
  voucherTypesInGroup,
  isVoucherType,
} from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'

const CHILD =
  'block rounded py-1.5 pl-6 pr-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/**
 * The "Vouchers" entry of the sidebar, carrying §5.3's twelve types beneath it.
 *
 * A disclosure rather than twelve always-visible rows: left open permanently
 * the group pushes Invoices/Accounts/Reports off a 16rem rail on a short
 * viewport, and navigation the user must scroll to is navigation they do not
 * know is there. It opens by itself whenever the pathname is inside
 * `/vouchers`, so arriving from any voucher link shows the list without a
 * second click, and a click pins it either way until they leave the section.
 *
 * `useSearchParams` needs a Suspense boundary — `Sidebar` wraps this component
 * — because the parent layout is part of statically-prerendered pages. It is
 * read only to mark the selected type with `aria-current`, so the fallback
 * degrades to "no type highlighted" rather than to no links at all.
 */
export function VoucherTypeNav({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const search = useSearchParams()

  const inSection = pathname === href || pathname.startsWith(`${href}/`)

  // A stale or hand-edited `?type=` reads as "no type selected", never as a
  // type — the same rule the vouchers list page applies.
  const raw = search.get('type')
  const activeType = raw !== null && isVoucherType(raw) ? (raw as VoucherType) : null

  const [pinned, setPinned] = useState<boolean | null>(null)
  const open = pinned ?? inSection

  const onNew = pathname === `${href}/new`
  // Exactly one entry claims `aria-current="page"`: the type row when one is
  // filtered, otherwise "New voucher" on that route, otherwise the parent —
  // which also covers `/vouchers/123`, where no child matches.
  const typeCurrent = activeType !== null && pathname === href
  const parentCurrent = inSection && !onNew && !typeCurrent

  const highlight = (on: boolean) =>
    on ? 'bg-background font-medium' : 'hover:bg-background'

  return (
    <li>
      <div className="flex items-stretch">
        <Link
          href={href}
          aria-current={parentCurrent ? 'page' : undefined}
          className={`flex-1 rounded px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${highlight(parentCurrent)}`}
        >
          {label}
        </Link>
        <button
          type="button"
          onClick={() => setPinned(!open)}
          aria-expanded={open}
          aria-controls="voucher-type-list"
          className="rounded px-2 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="sr-only">{open ? 'Hide' : 'Show'} voucher types</span>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      </div>

      <ul id="voucher-type-list" hidden={!open} className="mt-1 space-y-1">
        <li>
          <Link
            href={`${href}/new`}
            aria-current={onNew ? 'page' : undefined}
            className={`${CHILD} ${highlight(onNew)}`}
          >
            New voucher
          </Link>
        </li>
        {/* All twelve appear: this is a filter over the voucher list, which is
            meaningful for a document type even though it is *entered* on the
            invoice form. Grouped because "Payment, Receipt, Contra, Transfer"
            read as one list and "Journal, Adjustment" as another. */}
        {VOUCHER_GROUP_ORDER.map((g) => (
          <li key={g.group}>
            <p className="mt-2 pl-6 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </p>
            <ul className="mt-0.5">
              {voucherTypesInGroup(g.group).map((t) => {
                const spec = voucherTypeSpec(t)
                const current = typeCurrent && activeType === t
                return (
                  <li key={t}>
                    {/* `title` carries §5.3's one-liner: the rail is 16rem wide,
                        so showing all twelve summaries would triple the group's
                        height and bury the last eight types below the fold. */}
                    <Link
                      href={`${href}?type=${t}`}
                      aria-current={current ? 'page' : undefined}
                      title={
                        spec.entry === 'invoice'
                          ? `${spec.summary} Entered on the invoice form.`
                          : spec.summary
                      }
                      className={`${CHILD} ${highlight(current)}`}
                    >
                      {spec.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
        <li>
          <Link href="/invoices/new" className={`${CHILD} mt-1 underline`}>
            New sales / purchase document
          </Link>
        </li>
      </ul>
    </li>
  )
}