import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-500 shadow-none hover:text-gray-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

/** Shared button classes for the rare cases a `<Link>` or raw `<button>` is needed. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return [
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold shadow-sm transition',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    SIZES[size],
    VARIANTS[variant],
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Shows a spinner and blocks clicks while true. */
  loading?: boolean
}

/** Primary action button with variant/size presets and a built-in loading state. */
export default function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} className={buttonClass(variant, size, className)}>
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
