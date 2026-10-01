import type { ReactNode } from 'react'
import Link from 'next/link'

export type ActivityTab = 'vouchers' | 'invoices'

/**
 * Shell for the activity region: a view switcher plus one list.
 *
 * The switcher is a nav of links, not an ARIA tablist. `role="tab"` promises
 * arrow-key navigation and roving focus; two links that change the URL do not
 * implement that, and the URL is the better interface here — the active view is
 * linkable and survives a refresh.
 */
export function RecentActivity({
  tab,
  vouchersHref,
  invoicesHref,
  viewAllHref,
  children,
}: {
  tab: ActivityTab
  vouchersHref: string
  invoicesHref: string
  viewAllHref: string
  children: ReactNode
}) {
  const tabs: Array<{ key: ActivityTab; label: string; href: string }> = [
    { key: 'vouchers', label: 'Vouchers', href: vouchersHref },
    { key: 'invoices', label: 'Invoices', href: invoicesHref },
  ]

  return (
    <section aria-label="Recent activity" className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Recent activity</h2>
        <Link href={viewAllHref} className="text-xs underline">
          View all
        </Link>
      </div>

      <nav aria-label="Activity view" className="mt-3 flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === tab ? 'page' : undefined}
            className={`-mb-px border-b-2 px-2 py-1 text-sm ${
              t.key === tab
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-2">{children}</div>
    </section>
  )
}
