'use client'

import { useEffect, useState } from 'react'

export interface Me {
  id?: string
  email: string
  role: string
  tenantName: string
  tenantSlug: string
}

let cache: Me | null = null
let inflight: Promise<Me | null> | null = null

/** Fired when the session's company name (or tenant) changes and the badge is stale. */
export const ME_CHANGED = 'neurobook:me-changed'

/** Fetched once per page load and shared by every component that shows the session. */
export function loadMe(): Promise<Me | null> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        cache = j?.data ?? null
        return cache
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * Drops the shared cache and tells every mounted badge to refetch. Call this after
 * a rename or a company switch so the shell stops showing the previous name.
 */
export function invalidateMe() {
  cache = null
  inflight = null
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ME_CHANGED))
}

/** Refetches immediately, ignoring the cache. */
export function refreshMe(): Promise<Me | null> {
  cache = null
  inflight = null
  return loadMe()
}

/** Pass `false` when the caller already has server-rendered profile data. */
export function useMe(enabled = true): Me | null {
  const [me, setMe] = useState<Me | null>(enabled ? cache : null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadMe().then((data) => {
      if (alive) setMe(data)
    })

    function onChange() {
      void refreshMe().then((data) => {
        if (alive) setMe(data)
      })
    }
    window.addEventListener(ME_CHANGED, onChange)

    return () => {
      alive = false
      window.removeEventListener(ME_CHANGED, onChange)
    }
  }, [enabled])

  return me
}
