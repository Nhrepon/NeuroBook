import Link from 'next/link'

const ACTIONS = [
  { href: '/vouchers/new', label: 'New voucher', hint: 'Post a payment, receipt, or journal' },
  { href: '/invoices/new', label: 'New invoice', hint: 'Mushak 6.2 sales invoice' },
  { href: '/parties/new', label: 'New party', hint: 'Customer or supplier ledger' },
  { href: '/reports', label: 'Reports', hint: 'Trial balance, P&L, balance sheet' },
] as const

/**
 * Quick actions.
 *
 * Server component: four links need no client state. Keyboard shortcuts are
 * deliberately absent rather than half-implemented — a global hotkey that fires
 * while the user is typing in a voucher form is worse than no hotkey.
 */
export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="rounded-lg border bg-background p-4">
      <h2 className="text-sm font-medium text-muted-foreground">Quick actions</h2>
      <ul className="mt-3 space-y-1">
        {ACTIONS.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="block rounded px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="font-medium">{a.label}</span>
              <span className="block text-xs text-muted-foreground">{a.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
