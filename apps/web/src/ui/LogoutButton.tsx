'use client'

import { LogOut } from 'lucide-react'

export default function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button
      onClick={logout}
      title="Logout"
      className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
    >
      <LogOut size={18} className="shrink-0" />
      {!collapsed && <span>Logout</span>}
    </button>
  )
}
