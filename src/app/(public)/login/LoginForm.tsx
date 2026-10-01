'use client'

import { useActionState } from 'react'
import { loginAction } from '@/actions/auth.actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { ok: false, error: null })

  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border px-3 py-2"
        />
      </label>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-[hsl(var(--primary))] py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
