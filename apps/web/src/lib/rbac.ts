import type { Permission } from '@neurobook/shared'

/**
 * Maps an HTTP request to the permission(s) required to perform it.
 * Any one of the listed permissions grants access at this coarse gate; route
 * handlers then apply finer checks (for example per voucher type).
 * Returns null for safe reads, which every authenticated role may perform.
 */
export function requiredPermissions(method: string, pathname: string): Permission[] | null {
  if (pathname.startsWith('/api/v1/auth/')) return null
  if (pathname.startsWith('/api/v1/users')) return ['user:manage']
  if (pathname.startsWith('/api/v1/audit')) return ['audit:read']

  const read = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
  if (read) return null

  if (pathname.startsWith('/api/v1/vouchers')) {
    return ['voucher:write', 'sales:write', 'purchase:write', 'payment:write', 'receipt:write', 'stock:write']
  }
  if (pathname.startsWith('/api/v1/invoices')) return ['invoice:write']
  if (pathname.startsWith('/api/v1/periods')) return ['period:manage']
  if (pathname.startsWith('/api/v1/settings')) return ['settings:write']
  if (pathname.startsWith('/api/v1/bank')) return ['bank:write']
  if (pathname.startsWith('/api/v1/tax')) return ['tax:write']
  if (pathname.startsWith('/api/v1/accounts')) return ['account:write']
  if (pathname.startsWith('/api/v1/parties')) return ['party:write']
  if (pathname.startsWith('/api/v1/products')) return ['product:write']
  if (pathname.startsWith('/api/v1/stock')) return ['stock:write']
  return null
}

/** Pages that require a specific permission (checked by the proxy). */
export const PAGE_PERMISSIONS: ReadonlyArray<{ prefix: string; permission: Permission }> = [
  { prefix: '/dashboard/users', permission: 'user:manage' },
  { prefix: '/dashboard/companies', permission: 'tenant:manage' },
  { prefix: '/dashboard/settings', permission: 'settings:write' },
  { prefix: '/dashboard/audit', permission: 'audit:read' },
]

export function pagePermission(pathname: string): Permission | null {
  return PAGE_PERMISSIONS.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + '/'))?.permission ?? null
}
