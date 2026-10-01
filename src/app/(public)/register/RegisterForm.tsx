'use client'

import { useActionState } from 'react'
import { registerTenantAction } from '@/actions/register.actions'

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerTenantAction, { ok: false, error: null })

  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block">Company name</span>
        <input name="companyName" required maxLength={200} className="w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">Your email</span>
        <input name="email" type="email" required autoComplete="email" className="w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">Password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">e-BIN (optional)</span>
        <input name="bin" maxLength={32} className="w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">e-TIN (optional)</span>
        <input name="tin" maxLength={32} className="w-full rounded border px-3 py-2" />
      </label>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-[hsl(var(--primary))] py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}
