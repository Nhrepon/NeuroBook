import Link from 'next/link'
import { BookOpenCheck, CheckCircle2, Wallet } from 'lucide-react'

interface AuthShellProps {
  title: string
  subtitle: string
  headline: string
  points: string[]
  panelNote?: string
  children: React.ReactNode
}

/**
 * Shared split-screen frame for the auth pages: brand panel on desktop widened
 * and collapsed to a compact header on mobile.
 */
export default function AuthShell({ title, subtitle, headline, points, panelNote, children }: AuthShellProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-indigo-400/25 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <Wallet size={18} />
          </span>
          NeuroBook
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-snug tracking-tight">{headline}</h2>
          <ul className="mt-7 space-y-3 text-sm text-blue-50">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-200" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-blue-200">
          <BookOpenCheck size={14} aria-hidden />
          {panelNote ?? `© ${new Date().getFullYear()} NeuroBook · Built for Bangladesh`}
        </p>
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-6 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-blue-700 lg:hidden"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
              <Wallet size={16} />
            </span>
            NeuroBook
          </Link>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
            <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
