'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { VoucherTypeNav } from './VoucherTypeNav'

interface NavItem {
  href: string
  label: string
  /**
   * Render as an expandable group carrying §5.3's twelve voucher types
   * instead of a plain link.
   */
  types?: boolean
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/vouchers', label: 'Vouchers', types: true },
  { href: '/invoices', label: 'Invoices' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/parties', label: 'Parties' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

const LINK =
  'block rounded px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${LINK} ${active ? 'bg-background font-medium' : 'hover:bg-background'}`}
    >
      {label}
    </Link>
  )
}

/**
 * Primary navigation.
 *
 * A client component purely for `usePathname` — it takes no data. The active
 * item is marked with `aria-current="page"` so the state is not conveyed by
 * background colour alone, and a section stays marked while you are inside it,
 * so `/vouchers/123` does not make "Vouchers" look inactive.
 *
 * The Vouchers entry expands to §5.3's twelve types. Its child reads
 * `useSearchParams` to know which type is filtered, which needs a Suspense
 * boundary; the fallback is the plain link this rail has always rendered, so a
 * suspended render still navigates rather than dropping the item.
 *
 * The rail scrolls. With the group open it runs to roughly 1,400px, which
 * would otherwise clip Reports and Settings on a short viewport.
 */
export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="flex h-full flex-col overflow-y-auto p-4 text-sm">
      <p className="mb-6 text-base font-semibold">NeuroBook</p>
      <ul className="space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

          if (item.types) {
            return (
              <Suspense
                key={item.href}
                fallback={
                  <li>
                    <NavLink href={item.href} label={item.label} active={active} />
                  </li>
                }
              >
                <VoucherTypeNav href={item.href} label={item.label} />
              </Suspense>
            )
          }

          return (
            <li key={item.href}>
              <NavLink href={item.href} label={item.label} active={active} />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

