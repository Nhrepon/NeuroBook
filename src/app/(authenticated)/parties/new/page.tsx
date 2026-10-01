import type { Metadata } from 'next'
import { requireScope } from '@/db/scope'

export const metadata: Metadata = { title: 'New party' }

// Minimal create shell: the form POSTs to /api/v1/parties (JWT from the
// authenticated session cookie the middleware sets).
export default async function NewPartyPage() {
  await requireScope()
  return <PartyCreateForm />
}

function PartyCreateForm() {
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">New party</h1>
      <form
        action="/api/v1/parties"
        method="POST"
        className="space-y-3"
      >
        <label className="block text-sm">
          <span className="mb-1 block">Name</span>
          <input name="name" required maxLength={200} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Type</span>
          <select name="type" className="w-full rounded border px-3 py-2">
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="BOTH">Both</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">e-BIN</span>
          <input name="bin" maxLength={32} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">e-TIN</span>
          <input name="tin" maxLength={32} className="w-full rounded border px-3 py-2" />
        </label>
        <button
          type="submit"
          className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          Create party
        </button>
      </form>
    </div>
  )
}

