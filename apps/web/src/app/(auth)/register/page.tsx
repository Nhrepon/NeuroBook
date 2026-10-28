'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Lock, Mail } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, companySlug: companySlug || undefined, email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      setError(j?.error?.message ?? 'registration failed')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-emerald-700 to-emerald-500 text-white p-10">
        <Link href="/" className="text-xl font-bold">NeuroBook</Link>
        <div>
          <h2 className="text-3xl font-bold mb-3">Set up your company in a minute</h2>
          <ul className="space-y-2 text-emerald-50">
            <li>• Your own isolated workspace and data</li>
            <li>• Chart of accounts pre-configured</li>
            <li>• Invite your accountant with limited access</li>
          </ul>
        </div>
        <p className="text-sm text-emerald-100">© {new Date().getFullYear()} NeuroBook</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-6 text-center">
            <Link href="/" className="text-2xl font-bold text-emerald-700">NeuroBook</Link>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold mb-1">Create your account</h1>
            <p className="text-gray-500 mb-6">Start your company workspace</p>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Company name</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:ring-2 focus-within:ring-emerald-500">
                  <Building2 size={16} className="text-gray-400" />
                  <input
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="Acme Traders Ltd."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Company code <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="acme-traders"
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value)}
                  autoCapitalize="none"
                />
                <span className="mt-1 block text-xs text-gray-400">
                  Used to sign in. Leave blank and we will generate one.
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:ring-2 focus-within:ring-emerald-500">
                  <Mail size={16} className="text-gray-400" />
                  <input
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="you@company.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:ring-2 focus-within:ring-emerald-500">
                  <Lock size={16} className="text-gray-400" />
                  <input
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="At least 8 characters"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create workspace'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account? <Link href="/login" className="text-emerald-600 hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
