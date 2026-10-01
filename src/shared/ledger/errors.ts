// Stable error codes — part of the published REST contract. The mobile app
// maps each code to a localised user-facing string (U4 / §5.11).
export const LedgerErrorCode = {
  UNBALANCED: 'UNBALANCED',
  PERIOD_LOCKED: 'PERIOD_LOCKED',
  IMMUTABLE: 'IMMUTABLE',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
} as const

export type LedgerErrorCode = typeof LedgerErrorCode[keyof typeof LedgerErrorCode]

export class LedgerError extends Error {
  readonly code: LedgerErrorCode
  readonly field?: string

  constructor(code: LedgerErrorCode, message: string, field?: string) {
    super(message)
    this.name = 'LedgerError'
    this.code = code
    this.field = field
  }
}
