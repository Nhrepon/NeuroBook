'use client'

import { Building2 } from 'lucide-react'
import { useMe, type Me } from './useMe'

/**
 * Shows which company the current session is bound to. Every query in the app is
 * scoped to this tenant, so it is always visible in the shell.
 *
 * Pass `me` from a server component to render the company on the first paint;
 * without it the badge fetches `/api/v1/auth/me` on mount.
 */
export default function TenantBadge({
  compact = false,
  me: given,
  visiting = false,
}: {
  compact?: boolean
  me?: Me
  visiting?: boolean
}) {
  const fetched = useMe(!given)
  const me = given ?? fetched

  if (compact) {
    return (
      <div className="px-3 pb-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <Building2 size={12} className="shrink-0 text-gray-400" aria-hidden />
          <span className="truncate" title={me ? `${me.tenantName} (${me.tenantSlug})` : undefined}>
            {me?.tenantName ?? 'Loading...'}
          </span>
        </div>
        {me?.tenantSlug && <div className="truncate font-mono text-[10px] text-gray-400">{me.tenantSlug}</div>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
      <span className="flex items-center gap-2 font-semibold text-gray-900">
        <Building2 size={15} className="text-blue-600" aria-hidden />
        {me?.tenantName ?? 'Loading company...'}
      </span>
      {me?.tenantSlug && (
        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">{me.tenantSlug}</span>
      )}
      {visiting && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          Admin access
        </span>
      )}
      {me && (
        <span className="text-xs text-gray-500">
          {me.email} · <span className="font-medium text-gray-700">{me.role}</span>
        </span>
      )}
    </div>
  )
}
