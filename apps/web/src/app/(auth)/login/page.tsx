'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Loader2, Lock, Mail, Sparkles } from 'lucide-react'
import AuthShell from '@/ui/AuthShell'
import Field, { FormAlert } from '@/ui/Field'

const DEMO = { company: 'demo', email: 'admin@demo.com', password: 'password123' }

export default function LoginPage() {
  const router = useRouter()
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    // Reached after deleting the company the session was working in.
    if (new URLSearchParams(window.location.search).get('deleted')) {
      setNotice('That company and all of its data were deleted. Sign in with another company to continue.')
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim() || undefined, email: email.trim(), password }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const code = body?.error?.code
        setError(
          code === 'COMPANY_REQUIRED'
            ? 'This email is used by more than one company. Enter the company code to continue.'
            : (body?.error?.message ?? 'Could not sign you in. Please try again.'),
        )
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your company workspace"
      headline="Accounting built for Bangladesh"
      points={[
        'Double-entry vouchers with automatic fiscal-year numbering',
        'VAT and Mushak-ready tax invoices',
        'Every company fully isolated, every role scoped',
      ]}
    >
      <form onSubmit={submit} className="space-y-4">
        {notice && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{notice}</p>
        )}

        {error && <FormAlert message={error} />}

        <Field
          label="Company code"
          icon={Building2}
          optional
          placeholder="demo"
          autoComplete="organization"
          autoCapitalize="none"
          spellCheck={false}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          hint="Only needed when the same email exists in several companies."
        />

        <Field
          label="Email"
          icon={Mail}
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Field
          label="Password"
          icon={Lock}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5">
        <p className="text-xs text-gray-500">Exploring NeuroBook?</p>
        <button
          type="button"
          onClick={() => {
            setCompany(DEMO.company)
            setEmail(DEMO.email)
            setPassword(DEMO.password)
            setError(null)
          }}
          className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          <Sparkles size={13} aria-hidden />
          Fill demo login
        </button>
      </div>

      <p className="mt-6 border-t border-gray-100 pt-5 text-center text-sm text-gray-500">
        New to NeuroBook?{' '}
        <Link href="/register" className="font-semibold text-blue-600 hover:underline">
          Create a company workspace
        </Link>
      </p>
    </AuthShell>
  )
}
