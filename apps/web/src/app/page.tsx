import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  BarChart3, BookOpen, Building2, FileText, Landmark, Receipt, ShieldCheck, Smartphone,
} from 'lucide-react'

/**
 * Public landing page. A signed-in visitor goes straight to their workspace; the
 * session cookie is HttpOnly, so it is read here on the server (never in the
 * browser) and only its presence is checked — the proxy validates the token.
 */
export const dynamic = 'force-dynamic'

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Double-entry, done properly',
    body: 'Vouchers with gapless fiscal-year numbering, a full chart of accounts and running ledgers.',
  },
  {
    icon: Receipt,
    title: 'VAT & Mushak invoices',
    body: 'Itemised tax invoices with printed Mushak 6.2 documents, VAT and supplementary duty built in.',
  },
  {
    icon: Landmark,
    title: 'Money in and out',
    body: 'Receipts and payments settle invoices against cash or bank, and the ledger follows automatically.',
  },
  {
    icon: BarChart3,
    title: 'Reports that reconcile',
    body: 'Trial balance, profit & loss and balance sheet read straight from the posted journal.',
  },
  {
    icon: ShieldCheck,
    title: 'Isolated by company',
    body: 'Every company is separated at the database level, with role-scoped access and a full audit trail.',
  },
  {
    icon: Smartphone,
    title: 'Desktop and mobile',
    body: 'A keyboard-first web console plus an offline-first mobile app for the same books.',
  },
]

export default async function HomePage() {
  const store = await cookies()
  if (store.get('access_token')?.value) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white text-gray-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Building2 size={18} aria-hidden />
          </span>
          NeuroBook
        </span>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link href="/login" className="rounded-lg px-3 py-2 text-gray-600 transition hover:text-gray-900">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-12 pt-10 text-center">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700">
          <FileText size={13} aria-hidden />
          Accounting platform for Bangladesh
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Books that stand up to scrutiny</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          NeuroBook is a modern, multi-company accounting workspace — a Tally Prime alternative built for
          Bangladesh VAT, with double-entry rigour and a clear audit trail.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Create a company workspace
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-blue-600 bg-white px-6 py-3 font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <f.icon size={18} aria-hidden />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-gray-900">{f.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-gray-500">
          <span>© {new Date().getFullYear()} NeuroBook</span>
          <span className="flex items-center gap-4">
            <Link href="/login" className="transition hover:text-gray-700">
              Sign in
            </Link>
            <Link href="/register" className="transition hover:text-gray-700">
              Register
            </Link>
          </span>
        </div>
      </footer>
    </main>
  )
}
