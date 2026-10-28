'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { AccountType } from '@neurobook/shared'

export interface LedgerAccount {
  id: string
  name: string
  code: string
  type: AccountType
  isGroup: boolean
}

interface AccountPickerProps {
  accounts: LedgerAccount[]
  value: string
  onChange: (account: LedgerAccount | null) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

/**
 * Searchable ledger picker. Replaces the raw account-UUID text inputs and keeps
 * the account type in sync with the actual account, which the ledger needs on
 * every journal line.
 */
export default function AccountPicker({
  accounts,
  value,
  onChange,
  placeholder = 'Select ledger account',
  disabled,
  autoFocus,
  id,
}: AccountPickerProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Groups hold sub-accounts and cannot be posted against.
  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts])
  const selected = selectable.find((a) => a.id === value) ?? null
  const query = (typed ?? '').toLowerCase().trim()

  const results = useMemo(() => {
    if (!query) return selectable.slice(0, 50)
    return selectable
      .filter((a) => a.name.toLowerCase().includes(query) || a.code.toLowerCase().includes(query))
      .slice(0, 50)
  }, [selectable, query])

  useEffect(() => {
    setActive(0)
  }, [typed, open])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setTyped(null)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function pick(account: LedgerAccount) {
    onChange(account)
    setTyped(null)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const next = active + (e.key === 'ArrowDown' ? 1 : -1)
      setActive(Math.min(Math.max(next, 0), Math.max(results.length - 1, 0)))
      return
    }
    if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault()
        pick(results[active])
      }
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setTyped(null)
      return
    }
    if (e.key === 'Tab') setOpen(false)
  }

  const label = selected ? `${selected.code} · ${selected.name}` : ''
  const display = typed !== null ? typed : label

  return (
    <div ref={wrapRef} className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-7 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:bg-gray-50 disabled:text-gray-500"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          setTyped(e.target.value)
          setOpen(true)
          if (e.target.value === '') onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />

      {open && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full min-w-[240px] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">
              {selectable.length === 0 ? 'No postable accounts yet' : 'No accounts match'}
            </li>
          )}
          {results.map((account, i) => (
            <li
              key={account.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(account)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm ${i === active ? 'bg-blue-50' : ''}`}
            >
              <span className="truncate">
                <span className="font-mono text-xs text-gray-500">{account.code}</span>{' '}
                <span className="text-gray-900">{account.name}</span>
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{account.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
