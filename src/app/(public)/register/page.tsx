import type { Metadata } from 'next'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Create your tenant</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        U2 onboarding — we apply the Bangladesh chart-of-accounts template on save.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </div>
  )
}
