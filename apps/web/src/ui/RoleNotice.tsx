import { AlertTriangle } from 'lucide-react'

/** Amber banner explaining that the current role can read a page but not change it. */
export default function RoleNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
      {children}
    </p>
  )
}
