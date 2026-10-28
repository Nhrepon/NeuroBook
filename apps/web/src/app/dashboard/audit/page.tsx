'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  ScrollText,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { FormAlert } from '@/ui/Field'

interface AuditRow {
  id: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  before: unknown
  after: unknown
  ip: string | null
  actorRole: string | null
  userAgent: string | null
  route: string | null
  createdAt: string
  userEmail: string | null
  userRole: string | null
}

interface Company {
  name: string
  slug: string
}

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  update: 'bg-blue-50 text-blue-700 ring-blue-200',
  post: 'bg-violet-50 text-violet-700 ring-violet-200',
  reverse: 'bg-red-50 text-red-700 ring-red-200',
  delete: 'bg-red-50 text-red-700 ring-red-200',
  switch: 'bg-amber-50 text-amber-800 ring-amber-200',
  login: 'bg-gray-100 text-gray-600 ring-gray-300',
}

function badgeFor(action: string): string {
  const verb = action.split('.').pop() ?? action
  return ACTION_BADGE[verb] ?? 'bg-gray-100 text-gray-600 ring-gray-300'
}

/** A field the write touched, with what it looked like before and after. */
interface Change {
  key: string
  before: string | null
  after: string | null
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function show(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function truncate(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/**
 * Turns the `before` / `after` blobs into a per-field comparison, which is what
 * actually tells a reader what happened: `role: SALES → MANAGER`. Fields absent
 * on one side show as an em dash.
 */
function changesOf(before: unknown, after: unknown): Change[] {
  const b = isPlainObject(before) ? before : {}
  const a = isPlainObject(after) ? after : {}
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
  return keys.map((key) => {
    const from = show(b[key])
    const to = show(a[key])
    return { key, before: from, after: to }
  })
}

/**
 * A short "browser on system" label from a user-agent string. Enough to tell a
 * browser from the mobile app or a CI client; `curl`, `node` and raw HTTP
 * clients are named as such.
 */
function deviceOf(ua: string | null): string | null {
  if (!ua) return null
  const browser = /\bEdg\//.test(ua)
    ? 'Edge'
    : /\bOPR\/|\bOpera\b/.test(ua)
      ? 'Opera'
      : /\bChrome\/|\bCriOS\b/.test(ua)
        ? 'Chrome'
        : /\bFirefox\/|\bFxiOS\b/.test(ua)
          ? 'Firefox'
          : /\bSafari\b/.test(ua)
            ? 'Safari'
            : /^curl\b/.test(ua)
              ? 'curl'
              : /^node\b|node-fetch|undici/i.test(ua)
                ? 'Node script'
                : /okhttp|expo|react-native/i.test(ua)
                  ? 'Mobile app'
                  : 'Unknown client'
  const system = /\biPhone\b|\biPad\b/.test(ua)
    ? 'iOS'
    : /\bAndroid\b/.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return system ? `${browser} on ${system}` : browser
}

function Actor({ row }: { row: AuditRow }) {
  const role = row.actorRole ?? row.userRole
  if (!row.userEmail) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400" title={row.userId ?? 'user removed'}>
        <UserRound size={13} aria-hidden />
        {row.userId ? <span className="font-mono">{row.userId.slice(0, 8)}</span> : 'removed user'}
      </span>
    )
  }
  return (
    <span className="flex flex-col leading-tight">
      <span className="flex items-center gap-1.5 text-gray-800">
        <UserRound size={13} className="shrink-0 text-gray-400" aria-hidden />
        <span className="max-w-[220px] truncate" title={row.userEmail}>
          {row.userEmail}
        </span>
      </span>
      {role && (
        <span className="mt-0.5 w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {role}
        </span>
      )}
    </span>
  )
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/v1/audit')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load the audit log'))))
      .then((j) => {
        setRows(j.data ?? [])
        setCompany(j.meta?.company ?? null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the audit log'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const haystack = [
        r.action,
        r.resourceType,
        r.resourceId ?? '',
        r.userEmail ?? '',
        r.userRole ?? '',
        r.actorRole ?? '',
        r.ip ?? '',
        r.userAgent ?? '',
        r.route ?? '',
        ...changesOf(r.before, r.after).flatMap((c) => [c.key, c.before ?? '', c.after ?? '']),
      ]
      return haystack.some((v) => v.toLowerCase().includes(q))
    })
  }, [rows, query])

  const actors = useMemo(() => new Set(rows.map((r) => r.userEmail ?? r.userId ?? 'unknown')).size, [rows])

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <ScrollText size={22} className="text-blue-600" aria-hidden />
          Audit log
          {company && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
              {company.name}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every write against this company, newest first, with which user did it, what changed and where the request
          came from. Records are append-only and the newest 500 are shown.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
          <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
            placeholder="Search user, action, resource, IP or changed value"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search audit log"
          />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
          <ShieldCheck size={13} className="text-gray-400" aria-hidden />
          {visible.length} of {rows.length} events
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
          <UserRound size={13} className="text-gray-400" aria-hidden />
          {actors} {actors === 1 ? 'user' : 'users'}
        </span>
      </div>

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-8 px-2 py-2.5" />
                <th className="px-3 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">Resource</th>
                <th className="px-3 py-2.5 font-medium">Changes</th>
                <th className="px-3 py-2.5 font-medium">Where</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading audit log...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0 ? 'No audit events recorded yet.' : 'No events match this search.'}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => {
                  const changes = changesOf(row.before, row.after)
                  const isOpen = open.has(row.id)
                  const device = deviceOf(row.userAgent)
                  return (
                    <Fragment key={row.id}>
                      <tr onClick={() => toggle(row.id)} className="cursor-pointer align-top hover:bg-gray-50/70">
                        <td className="px-2 py-2.5 text-gray-400">
                          {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">
                          {new Date(row.createdAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2.5">
                          <Actor row={row} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeFor(row.action)}`}
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          <span className="block">{row.resourceType}</span>
                          {row.resourceId && (
                            <span className="font-mono text-xs text-gray-400" title={row.resourceId}>
                              {row.resourceId.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {changes.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {changes.slice(0, 2).map((c) => (
                                <li key={c.key} className="text-xs">
                                  <span className="font-medium text-gray-700">{c.key}</span>{' '}
                                  <span className="text-gray-400">{c.before ?? '—'}</span>{' '}
                                  <span className="text-gray-400">→</span>{' '}
                                  <span className="text-gray-900">{c.after ?? '—'}</span>
                                </li>
                              ))}
                              {changes.length > 2 && (
                                <li className="text-xs text-gray-400">+{changes.length - 2} more</li>
                              )}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          <span className="flex flex-col gap-0.5 text-xs">
                            <span className="font-mono text-gray-700" title="Client IP">
                              {row.ip || <span className="text-gray-300">no IP</span>}
                            </span>
                            {device && (
                              <span className="inline-flex items-center gap-1 text-gray-500" title={row.userAgent ?? ''}>
                                <Globe size={11} aria-hidden />
                                {device}
                              </span>
                            )}
                            {row.route && <span className="font-mono text-[10px] text-gray-400">{row.route}</span>}
                          </span>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-gray-50/70">
                          <td />
                          <td colSpan={6} className="px-3 py-3">
                            <div className="grid gap-5 lg:grid-cols-3">
                              <div className="lg:col-span-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  What changed
                                </h3>
                                {changes.length === 0 ? (
                                  <p className="mt-1.5 text-sm text-gray-500">
                                    No field-level detail recorded for this event.
                                  </p>
                                ) : (
                                  <table className="mt-1.5 w-full text-xs">
                                    <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                                      <tr>
                                        <th className="py-1 pr-3 font-medium">Field</th>
                                        <th className="py-1 pr-3 font-medium">Before</th>
                                        <th className="py-1 font-medium">After</th>
                                      </tr>
                                    </thead>
                                    <tbody className="align-top">
                                      {changes.map((c) => (
                                        <tr key={c.key} className="border-t border-gray-200/70">
                                          <td className="py-1 pr-3 font-medium text-gray-700">{c.key}</td>
                                          <td className="py-1 pr-3 font-mono text-gray-500" title={c.before ?? undefined}>
                                            {c.before === null ? '—' : truncate(c.before)}
                                          </td>
                                          <td className="py-1 font-mono text-gray-900" title={c.after ?? undefined}>
                                            {c.after === null ? '—' : truncate(c.after)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}

                                {(row.before !== null || row.after !== null) && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                                      Raw JSON
                                    </summary>
                                    <pre className="mt-1.5 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white p-2 font-mono text-[11px] leading-relaxed text-gray-700">
{JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>

                              <div className="space-y-2 text-xs">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Who &amp; where
                                </h3>
                                <p className="text-gray-600">
                                  Company <span className="ml-1 text-gray-800">{company?.name ?? '—'}</span>
                                  {company && <span className="ml-1 font-mono text-gray-400">{company.slug}</span>}
                                </p>
                                <p className="text-gray-600">
                                  User <span className="ml-1 text-gray-800">{row.userEmail ?? 'removed'}</span>
                                  {row.actorRole && (
                                    <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                      as {row.actorRole}
                                    </span>
                                  )}
                                  {row.actorRole && row.userRole && row.actorRole !== row.userRole && (
                                    <span className="ml-1 text-gray-400">(now {row.userRole})</span>
                                  )}
                                </p>
                                {row.userId && (
                                  <p className="text-gray-600">
                                    User ID <span className="ml-1 font-mono text-gray-800">{row.userId}</span>
                                  </p>
                                )}
                                <p className="text-gray-600">
                                  IP <span className="ml-1 font-mono text-gray-800">{row.ip ?? 'not captured'}</span>
                                </p>
                                <p className="text-gray-600">
                                  Device <span className="ml-1 text-gray-800">{device ?? 'not captured'}</span>
                                </p>
                                {row.userAgent && (
                                  <p className="break-all font-mono text-[10px] leading-relaxed text-gray-400">
                                    {row.userAgent}
                                  </p>
                                )}
                                <p className="text-gray-600">
                                  Endpoint{' '}
                                  <span className="ml-1 font-mono text-gray-800">{row.route ?? 'not recorded'}</span>
                                </p>
                                {row.resourceId && (
                                  <p className="text-gray-600">
                                    {row.resourceType} ID{' '}
                                    <span className="ml-1 font-mono text-gray-800">{row.resourceId}</span>
                                  </p>
                                )}
                                <p className="text-gray-600">
                                  Recorded{' '}
                                  <span className="ml-1 text-gray-800">{new Date(row.createdAt).toLocaleString()}</span>
                                </p>
                                <p className="text-gray-600">
                                  Event ID <span className="ml-1 font-mono text-gray-800">{row.id}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
