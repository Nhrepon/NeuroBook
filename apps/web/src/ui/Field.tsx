'use client'

import { useId, useState } from 'react'
import { AlertCircle, Eye, EyeOff, type LucideIcon } from 'lucide-react'

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  icon?: LucideIcon
  hint?: React.ReactNode
  optional?: boolean
  className?: string
}

/** Labeled input with an optional leading icon and a reveal toggle for passwords. */
export default function Field({ label, icon: Icon, hint, optional, className, id, type = 'text', ...rest }: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-gray-700">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-gray-400">optional</span>}
      </label>

      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
        {Icon && <Icon size={16} className="shrink-0 text-gray-400" aria-hidden />}
        <input
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          aria-describedby={hintId}
          className="w-full bg-transparent py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="shrink-0 rounded p-1 text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-gray-400">
          {hint}
        </p>
      )}
    </div>
  )
}

export function FormAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
