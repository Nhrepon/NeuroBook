import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel?: string
  /** Extra classes for the wrapper, e.g. `max-w-sm` or `flex-1`. */
  className?: string
}

/** Search box with a leading icon, shared by every list page. */
export default function SearchInput({ value, onChange, placeholder, ariaLabel, className = 'max-w-sm' }: SearchInputProps) {
  return (
    <div
      className={`flex min-w-[200px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 ${className}`}
    >
      <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
      <input
        className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  )
}
