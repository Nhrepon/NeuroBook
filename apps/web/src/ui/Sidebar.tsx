'use client'

import { useState } from 'react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'
import TenantBadge from './TenantBadge'
import {
  ChevronsLeft, ChevronsRight, LayoutDashboard, FileText, PlusCircle, BookOpen, Receipt, Users, Package,
  ShoppingCart, TrendingUp, BarChart3, Landmark, Settings, ScrollText, UserCog, Building2, Tags,
} from 'lucide-react'
import { ROLE_LABELS, can, type Permission, type Role } from '@neurobook/shared'

type RoleName = Role | Lowercase<Role>
type AccessEntry = Permission | RoleName

type MenuItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /**
   * A permission key (`voucher:write`), a role name (`admin` / `ADMIN`), or an
   * array of either. Arrays pass when at least one entry matches.
   * Example: `permission: ['admin', 'accountant']`
   */
  permission?: AccessEntry | readonly AccessEntry[]
}

const menu: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/vouchers', label: 'Vouchers', icon: FileText },
  { href: '/dashboard/accounts', label: 'Accounts (Ledger)', icon: BookOpen, permission: ['account:write'] },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt, permission: ['invoice:write'] },
  { href: '/dashboard/parties', label: 'Parties', icon: Users, permission: ['party:write'] },
  { href: '/dashboard/products', label: 'Products', icon: Package, permission: ['product:write'] },
  { href: '/dashboard/categories', label: 'Product Categories', icon: Tags, permission: ['product:write'] },
  { href: '/dashboard/purchases', label: 'Purchases', icon: ShoppingCart, permission: ['purchase:write'] },
  { href: '/dashboard/sales', label: 'Sales', icon: TrendingUp, permission: ['sales:write'] },
  { href: '/dashboard/payments', label: 'Payments', icon: ShoppingCart, permission: ['payment:write'] },
  { href: '/dashboard/receipts', label: 'Receipts', icon: Receipt, permission: ['receipt:write'] },
  { href: '/dashboard/stock', label: 'Stock', icon: Package, permission: ['stock:write'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/bank', label: 'Bank', icon: Landmark, permission: ['bank:write'] },
  { href: '/dashboard/users', label: 'Users & Roles', icon: UserCog, permission: ['admin'] },
  { href: '/dashboard/companies', label: 'Companies', icon: Building2, permission: ['tenant:manage'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, permission: ['settings:write'] },
  { href: '/dashboard/audit', label: 'Audit Log', icon: ScrollText, permission: ['audit:read'] },
]

function matches(role: Role, entry: AccessEntry) {
  const value = String(entry)
  // Role names are matched case-insensitively: 'admin' === 'ADMIN'.
  if (value.toLowerCase() === role.toLowerCase()) return true
  // Permission keys contain ':', which keeps them distinct from role names.
  return value.includes(':') && can(role, value as Permission)
}

function hasAccess(role: Role, access: MenuItem['permission']) {
  if (!access) return true
  const list = Array.isArray(access) ? access : [access]
  return list.some((entry) => matches(role, entry))
}

export default function Sidebar({ role = 'VIEWER' }: { role?: Role }) {
  const [collapsed, setCollapsed] = useState(false)
  const items = menu.filter((m) => hasAccess(role, m.permission))

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} sticky top-0 h-screen shrink-0 border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200`}>
      <div className="shrink-0 border-b border-gray-200">
        <div className={`flex items-center p-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {/* {!collapsed && <span className="font-bold">NeuroBook</span>} */}
          {!collapsed && <TenantBadge compact />}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            {collapsed ? <ChevronsRight size={15} aria-hidden /> : <ChevronsLeft size={15} aria-hidden />}
          </button>
        </div>
        
      </div>
      <nav className="flex-1 overflow-y-auto p-2 gap-1 flex flex-col scrollbar-hide">
        {items.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.href}
              href={m.href}
              title={m.label}
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 text-sm"
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{m.label}</span>}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto p-2 border-t border-gray-200 shrink-0">
        {!collapsed && (
          <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            {ROLE_LABELS[role]}
          </div>
        )}
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  )
}
