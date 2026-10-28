import type { AccountType } from './types'

export interface SeedAccount {
  code: string
  name: string
  type: AccountType
  isGroup?: boolean
  taxApplicable?: boolean
}

/**
 * Default chart of accounts for a new company, tuned for Bangladesh:
 * VAT input/payable split, receivables/payables, stock, and the usual expense heads.
 * Codes are stable contract points — invoice defaults resolve by code, so do not renumber.
 */
export const DEFAULT_CHART: SeedAccount[] = [
  { code: '1100', name: 'Cash in Hand', type: 'ASSET' },
  { code: '1110', name: 'Petty Cash', type: 'ASSET' },
  { code: '1120', name: 'Bank Account', type: 'ASSET' },
  { code: '1130', name: 'Mobile Wallet (bKash/Nagad)', type: 'ASSET' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1300', name: 'Inventory', type: 'ASSET' },
  { code: '1400', name: 'VAT Input (Receivable)', type: 'ASSET', taxApplicable: true },
  { code: '1500', name: 'Advances & Prepayments', type: 'ASSET' },
  { code: '1600', name: 'Office Equipment', type: 'ASSET' },
  { code: '1700', name: 'Furniture & Fixtures', type: 'ASSET' },

  { code: '2100', name: 'VAT Payable', type: 'LIABILITY', taxApplicable: true },
  { code: '2200', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2300', name: 'Loans & Borrowings', type: 'LIABILITY' },
  { code: '2400', name: 'Accrued Expenses', type: 'LIABILITY' },
  { code: '2500', name: 'Salary Payable', type: 'LIABILITY' },
  { code: '2600', name: 'Income Tax Payable', type: 'LIABILITY' },

  { code: '3000', name: "Owner's Capital", type: 'EQUITY' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
  { code: '3200', name: "Owner's Drawings", type: 'EQUITY' },

  { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
  { code: '4100', name: 'Service Revenue', type: 'REVENUE' },
  { code: '4200', name: 'Sales Returns', type: 'REVENUE' },
  { code: '4300', name: 'Other Income', type: 'REVENUE' },
  { code: '4400', name: 'Discount Received', type: 'REVENUE' },

  { code: '5000', name: 'General Expense', type: 'EXPENSE' },
  { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { code: '5200', name: 'Purchases', type: 'EXPENSE' },
  { code: '5300', name: 'Purchase Returns', type: 'EXPENSE' },
  { code: '5400', name: 'Salaries & Wages', type: 'EXPENSE' },
  { code: '5500', name: 'Rent', type: 'EXPENSE' },
  { code: '5600', name: 'Utilities', type: 'EXPENSE' },
  { code: '5700', name: 'Transport & Freight', type: 'EXPENSE' },
  { code: '5800', name: 'Office Supplies', type: 'EXPENSE' },
  { code: '5900', name: 'Bank Charges', type: 'EXPENSE' },
  { code: '6000', name: 'Marketing & Advertising', type: 'EXPENSE' },
  { code: '6100', name: 'Repairs & Maintenance', type: 'EXPENSE' },
  { code: '6200', name: 'Depreciation', type: 'EXPENSE' },
  { code: '6300', name: 'Professional Fees', type: 'EXPENSE' },
  { code: '6400', name: 'Miscellaneous Expense', type: 'EXPENSE' },
]

/** Account codes the invoice entry screens resolve to by default. */
export const INVOICE_ACCOUNTS = {
  sales: { party: '1200', income: '4000', tax: '2100', partyType: 'ASSET', incomeType: 'REVENUE', taxType: 'LIABILITY' },
  purchase: { party: '2200', income: '5200', tax: '1400', partyType: 'LIABILITY', incomeType: 'EXPENSE', taxType: 'ASSET' },
} as const

/** Bangladesh VAT rates commonly used on invoices (truncated base rates). */
export const VAT_RATES = [0, 5, 7.5, 10, 15] as const

export function accountByCode<T extends { code: string }>(accounts: T[], code: string): T | undefined {
  return accounts.find((a) => a.code === code)
}