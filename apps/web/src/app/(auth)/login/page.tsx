'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: company || undefined, email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      setError(j?.error?.message ?? 'login failed')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-blue-700 to-blue-500 text-white p-10">
        <Link href="/" className="text-xl font-bold">NeuroBook</Link>
        <div>
          <h2 className="text-3xl font-bold mb-3">Accounting built for Bangladesh</h2>
          <p className="text-blue-100 leading-relaxed">
            Double-entry vouchers, VAT/Mushak invoices, and real-time reports — with strict
            per-company isolation and role-based access.
          </p>
        </div>
        <p className="text-sm text-blue-200">© {new Date().getFullYear()} NeuroBook</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-6 text-center">
            <Link href="/" className="text-2xl font-bold text-blue-700">NeuroBook</Link>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-gray-500 mb-6">Sign in to your company workspace</p>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Company code</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:ring-2 focus-within:ring-blue-500">
                  <Building2 size={16} className="text-gray-400" />
                  <input
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="demo (optional)"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    autoCapitalize="none"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:ring-2 focus-within:ring-blue-500">
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
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:ring-2 focus-within:ring-blue-500">
                  <Lock size={16} className="text-gray-400" />
                  <input
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              No account? <Link href="/register" className="text-blue-600 hover:underline">Create one</Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            Demo: company <span className="font-mono">demo</span> · admin@demo.com · password123
          </p>
        </div>
      </div>
    </div>
  )
}
