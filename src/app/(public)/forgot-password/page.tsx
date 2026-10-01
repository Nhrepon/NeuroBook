import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reset password' }

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <p className="mt-6 text-sm">Password reset form goes here.</p>
    </div>
  )
}
