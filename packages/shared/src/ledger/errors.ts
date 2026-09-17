/**
 * Ledger error codes. Each maps to an HTTP status and a user-readable message
 * in the active locale (§15.4 U8). The codes are the API contract — the
 * messages are translated at the edge.
 */
export type LedgerErrorCode =
  | "UNBALANCED"
  | "PERIOD_LOCKED"
  | "ALREADY_POSTED"
  | "NOT_POSTED"
  | "ALREADY_REVERSED"
  | "IMMUTABLE_POSTED"
  | "CONFLICT"
  | "UNKNOWN_ACCOUNT";

export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export const UNBALANCED = new LedgerError(
  "UNBALANCED",
  "Debits must equal credits exactly, with at least two non-negative entries.",
  422,
);

export const PERIOD_LOCKED = new LedgerError(
  "PERIOD_LOCKED",
  "The fiscal period for this date is closed. Only a super admin may reopen it.",
  409,
);

export const ALREADY_POSTED = new LedgerError(
  "ALREADY_POSTED",
  "This voucher is already posted.",
  409,
);

export const NOT_POSTED = new LedgerError(
  "NOT_POSTED",
  "Only a posted voucher can be reversed.",
  409,
);

export const ALREADY_REVERSED = new LedgerError(
  "ALREADY_REVERSED",
  "This voucher has already been reversed.",
  409,
);

export const IMMUTABLE_POSTED = new LedgerError(
  "IMMUTABLE_POSTED",
  "An immutable posted voucher cannot be edited. Reverse it with a correction voucher instead.",
  409,
);

export const UNKNOWN_ACCOUNT = new LedgerError(
  "UNKNOWN_ACCOUNT",
  "An entry references an account that does not exist in this tenant's chart of accounts.",
  422,
);
