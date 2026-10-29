import { X } from 'lucide-react'

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
} as const

interface ModalProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  /** Buttons pinned to a bordered footer row. */
  footer?: React.ReactNode
  size?: keyof typeof WIDTHS
  children: React.ReactNode
}

/** Centered dialog with a dimmed backdrop. Renders only when mounted. */
export default function Modal({ title, subtitle, onClose, footer, size = 'lg', children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${WIDTHS[size]} rounded-xl border border-gray-200 bg-white p-4 shadow-xl sm:p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">{footer}</div>}
      </div>
    </div>
  )
}
