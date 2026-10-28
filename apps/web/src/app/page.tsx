'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const token = document.cookie.split('; ').find((c) => c.startsWith('access_token='))
    if (token) router.replace('/dashboard')
  }, [router])

  const features = [
    'Double-entry vouchers with gapless numbering',
    'Trial balance, P&L, balance sheet',
    'BD VAT/TDS/Mushak compliance',
    'Multi-tenant with row-level security',
    'Offline-first mobile and desktop',
    'Keyboard-first, accessible UX',
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">NeuroBook</h1>
        <p className="text-lg text-gray-600 mb-8">Accounting platform for Bangladesh — Tally Prime alternative</p>
        <div className="flex justify-center gap-4 mb-12">
          <Link href="/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Login</Link>
          <Link href="/register" className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50">Register</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {features.map((f) => (
            <div key={f} className="border rounded-lg p-4 bg-white shadow-sm">{f}</div>
          ))}
        </div>
      </section>
    </main>
  )
}
