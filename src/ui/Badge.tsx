import type { ReactNode } from 'react'

/**
 * A status chip.
 *
 * Tone is always accompanied by text in the chip, so the meaning survives
 * without colour perception.
 */
const TONES = {
  neutral: 'border-border bg-muted text-foreground',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-danger/40 bg-danger/10 text-danger',
  info: 'border-info/40 bg-info/10 text-info',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: BadgeTone
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/** Voucher status → chip. Exported so every list renders a status identically. */
export function voucherTone(status: string): BadgeTone {
  if (status === 'posted') return 'success'
  if (status === 'draft') return 'warning'
  if (status === 'reversed') return 'info'
  return 'neutral'
}
