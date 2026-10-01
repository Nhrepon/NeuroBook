import type { ReactNode } from 'react'
import { Sidebar } from '@/ui/Sidebar'
import { Topbar } from '@/ui/Topbar'

/**
 * Authenticated shell.
 *
 * Deliberately data-free: it renders the chrome and nothing else. The dashboard
 * slots live under `dashboard/`, because a parallel-route slot belongs to the
 * segment that declares it — declaring `@analytics`/`@recent` here bound them to
 * this group's own URL (`/`), so on `/dashboard` they fell back to `default.tsx`
 * (null) and never rendered, while every other page in the group was handed the
 * dashboard's slots.
 *
 * The grid collapses to a single column below `md`: a fixed 16rem rail on a
 * 390px screen leaves 134px for the ledger.
 */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[3.5rem_1fr] md:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <aside className="row-span-2 hidden border-r bg-accent md:block">
        <Sidebar />
      </aside>

      {/* Sticky header inside the scrolling area: 100+ row ageing tables are
          read from the top of the page, so the period and sign-out must stay
          reachable. */}
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 backdrop-blur">
        <Topbar />
      </header>

      {/* min-w-0 stops a wide table from blowing out its grid track. */}
      <main id="main" className="min-w-0 overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}

