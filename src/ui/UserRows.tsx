'use client'

import { useActionState } from 'react'
import { updateUserAction } from '@/actions/settings.actions'

interface UserRow {
  id: string
  email: string
  role: string
  active: boolean
  fullName: string | null
  totpEnabled: boolean
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'STAFF', 'SALES', 'AUDITOR', 'USER', 'GUEST', 'VIEWER'] as const

export function UserRows({ users, canManage }: { users: UserRow[]; canManage: boolean }) {
  const [, action, pending] = useActionState(updateUserAction, { ok: false })

  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
          <th className="py-2">Email</th>
          <th className="py-2">Name</th>
          <th className="py-2">2FA</th>
          {canManage && <th className="py-2">Role</th>}
          {canManage && <th className="py-2">Active</th>}
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <UserRowClient key={u.id} user={u} canManage={canManage} action={action} pending={pending} />
        ))}
      </tbody>
    </table>
  )
}

function UserRowClient({
  user,
  canManage,
  action,
  pending,
}: {
  user: UserRow
  canManage: boolean
  /**
   * The dispatch `useActionState` returns. The previous state is already bound
   * by the hook, so this takes the payload alone — passing `{ ok: false }` as
   * the first argument would send the state as the form payload.
   */
  action: (payload: FormData) => void
  pending: boolean
}) {
  function submit(kind: 'role' | 'active', value: string) {
    const fd = new FormData()
    fd.set('userId', user.id)
    // `updateUserAction` reads `active` and treats anything that is not 'on' as
    // off, so 'off' is sent explicitly. Passing `undefined` to `set()` is not a
    // valid value — it is stringified to "undefined".
    if (kind === 'role') fd.set('role', value)
    else fd.set('active', value === 'on' ? 'on' : 'off')
    action(fd)
  }

  return (
    <tr className="border-b">
      <td className="py-2">{user.email}</td>
      <td className="py-2">{user.fullName ?? '—'}</td>
      <td className="py-2">{user.totpEnabled ? 'enabled' : 'off'}</td>
      {canManage && (
        <td className="py-2">
          <select
            value={user.role}
            disabled={pending}
            onChange={(e) => submit('role', e.target.value)}
            className="rounded border px-2 py-1 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </td>
      )}
      {canManage && (
        <td className="py-2">
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={user.active}
              disabled={pending}
              onChange={() => submit('active', user.active ? 'off' : 'on')}
            />
            active
          </label>
        </td>
      )}
    </tr>
  )
}
