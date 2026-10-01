import { LoginForm } from './LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">NeuroBook</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Sign in to your account
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  )
}
