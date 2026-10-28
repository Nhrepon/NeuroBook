import type { VoucherType } from './types'

export const ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES', 'PURCHASER', 'CASHIER', 'STORE_KEEPER', 'AUDITOR', 'VIEWER'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  SALES: 'Sales',
  PURCHASER: 'Purchaser',
  CASHIER: 'Cashier',
  STORE_KEEPER: 'Store Keeper',
  AUDITOR: 'Auditor',
  VIEWER: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Full access, including users, settings, and period closing.',
  MANAGER: 'Everything except user and company administration.',
  ACCOUNTANT: 'All day-to-day accounting, masters, banking, and audit.',
  SALES: 'Sales invoices, receipts, and customers.',
  PURCHASER: 'Purchase invoices, payments, suppliers, and stock.',
  CASHIER: 'Receipts, payments, and bank transactions.',
  STORE_KEEPER: 'Products and stock movements only.',
  AUDITOR: 'Read-only access plus the audit log.',
  VIEWER: 'Read-only access to reports and ledgers.',
}

export const PERMISSIONS = [
  'voucher:write',
  'sales:write',
  'purchase:write',
  'payment:write',
  'receipt:write',
  'invoice:write',
  'account:write',
  'party:write',
  'product:write',
  'stock:write',
  'bank:write',
  'tax:write',
  'settings:write',
  'period:manage',
  'user:manage',
  'tenant:switch',
  'tenant:manage',
  'audit:read',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/**
 * Single source of truth for authorization. The web proxy, API routes, and UI
 * all derive from this map so they cannot drift apart.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: PERMISSIONS.filter((p) => p !== 'user:manage' && p !== 'tenant:manage'),
  ACCOUNTANT: [
    'voucher:write', 'sales:write', 'purchase:write', 'payment:write', 'receipt:write',
    'invoice:write', 'account:write', 'party:write', 'product:write', 'stock:write',
    'bank:write', 'tax:write', 'audit:read',
  ],
  SALES: ['sales:write', 'invoice:write', 'receipt:write', 'party:write'],
  PURCHASER: ['purchase:write', 'payment:write', 'party:write', 'product:write', 'stock:write'],
  CASHIER: ['receipt:write', 'payment:write', 'bank:write'],
  STORE_KEEPER: ['product:write', 'stock:write'],
  AUDITOR: ['audit:read'],
  VIEWER: [],
}

/** Which permission is needed to create a voucher of each type. */
export const VOUCHER_TYPE_PERMISSION: Record<VoucherType, Permission> = {
  SALES_INVOICE: 'sales:write',
  CREDIT_NOTE: 'sales:write',
  PURCHASE_INVOICE: 'purchase:write',
  DEBIT_NOTE: 'purchase:write',
  RECEIPT: 'receipt:write',
  PAYMENT: 'payment:write',
  REFUND: 'payment:write',
  STOCK_TRANSFER: 'stock:write',
  JOURNAL: 'voucher:write',
  CONTRA: 'voucher:write',
  TRANSFER: 'voucher:write',
  ADJUSTMENT: 'voucher:write',
}

export function voucherTypePermission(type: VoucherType): Permission {
  return VOUCHER_TYPE_PERMISSION[type] ?? 'voucher:write'
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** Unknown or legacy roles degrade to the least-privileged role. */
export function normalizeRole(value: unknown): Role {
  return isRole(value) ? value : 'VIEWER'
}

export function can(role: unknown, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].includes(permission)
}

/** True only when the role holds every listed permission. */
export function canAll(role: unknown, permissions: readonly Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[normalizeRole(role)]
  return permissions.every((p) => granted.includes(p))
}

/** True when the role holds at least one of the listed permissions. */
export function canAny(role: unknown, permissions: readonly Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[normalizeRole(role)]
  return permissions.some((p) => granted.includes(p))
}

export function permissionsFor(role: unknown): readonly Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)]
}

export interface RateLimiter {
  hit(key: { scope: string; id: string; route: string }, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }>
}
export const RATE_LIMITS = { globalPerTenant: { limit: 300, windowSeconds: 60 }, authPerIp: { limit: 10, windowSeconds: 60 } } as const
