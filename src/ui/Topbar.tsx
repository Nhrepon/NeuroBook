import { logoutAction } from '@/actions/auth.actions'

/**
 * Top bar.
 *
 * Carries only what is true on every authenticated page: the wordmark (the
 * sidebar is hidden below `md`, so this is the only branding a phone sees) and
 * sign-out. The period selector lives with the figures it scopes, in the
 * dashboard's KPI region — a control that belongs to one page does not belong in
 * shared chrome.
 */
export function Topbar() {
  return (
    <div className="flex h-full w-full items-center justify-between">
      <span className="text-sm font-semibold md:hidden">NeuroBook</span>
      <form action={logoutAction} className="ml-auto">
        <button
          type="submit"
          className="rounded border px-2 py-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}

