'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, email, password }),
    })
    if (!res.ok) { const j = await res.json(); setError(j?.error?.message ?? 'register failed'); return }
    router.push('/')
  }

  return (
    <main style={{ padding: 24, maxWidth: 400 }}>
      <h1>Register</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Create account</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p><a href="/login">Already have an account?</a></p>
    </main>
  )
}
