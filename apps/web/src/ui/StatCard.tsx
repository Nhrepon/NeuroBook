import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Text colour for the value, defaults to gray-900. */
  tone?: string
  /** Small icon shown before the label. */
  icon?: LucideIcon
  /** Muted line under the value. */
  hint?: React.ReactNode
}

/** A single summary figure shown above a list. */
export function StatCard({ label, value, tone = 'text-gray-900', icon: Icon, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {Icon && <Icon size={13} className="text-gray-400" aria-hidden />}
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

/** Responsive row of {@link StatCard}s. Override `className` for other breakpoints. */
export function StatGrid({ className = 'sm:grid-cols-3', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mb-5 grid gap-3 ${className}`}>{children}</div>
}
