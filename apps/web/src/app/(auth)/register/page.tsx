'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Check, Loader2, Lock, Mail, Tag } from 'lucide-react'
import AuthShell from '@/ui/AuthShell'
import Field, { FormAlert } from '@/ui/Field'
import { baseSlug } from '@/lib/company-slug'

export default function RegisterPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const slug = useMemo(() => baseSlug(companySlug || companyName), [companySlug, companyName])
  const passwordOk = password.length >= 8

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companySlug: companySlug.trim() || undefined,
          email: email.trim(),
          password,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not create your workspace. Please try again.')
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
      title="Create your workspace"
      subtitle="One account, one isolated company. Ready in a minute."
      headline="Set up your company in a minute"
      points={[
        'Your own isolated workspace with private data',
        'Chart of accounts pre-configured for local trade',
        'Invite your accountant, cashier, or auditor with scoped roles',
      ]}
      panelNote="Free while in preview · No card required"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <FormAlert message={error} />}

        <Field
          label="Company name"
          icon={Building2}
          placeholder="Acme Traders Ltd."
          autoComplete="organization"
          required
          autoFocus
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <Field
          label="Company code"
          icon={Tag}
          optional
          placeholder="acme-traders"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={companySlug}
          onChange={(e) => setCompanySlug(e.target.value)}
          hint={
            slug ? (
              <>
                Sign in with code{' '}
                <span className="font-mono text-gray-600">{slug}</span>
                {!companySlug && ' — we add a suffix if it is taken.'}
              </>
            ) : (
              'Used to sign in. Leave blank and we will generate one.'
            )
          }
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
          hint="You will sign in with this address."
        />

        <Field
          label="Password"
          icon={Lock}
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={
            passwordOk ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <Check size={13} aria-hidden />
                Strong enough
              </span>
            ) : (
              'Use 8 or more characters.'
            )
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            <>
              Create workspace
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 border-t border-gray-100 pt-5 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
