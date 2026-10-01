'use client'

import { useActionState } from 'react'
import { updateTenantAction } from '@/actions/settings.actions'
import { Button } from './Button'

export function TenantForm({ initial }: { initial: { name: string; bin: string | null; tin: string | null; address: string | null; division: string | null; district: string | null; upazila: string | null; union: string | null } | null }) {
  const [state, action, pending] = useActionState(updateTenantAction, { ok: false, error: undefined })
  return (
    <form action={action} className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-sm"><span className="mb-1 block">Name</span>
        <input name="name" required defaultValue={initial?.name} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">e-BIN</span>
        <input name="bin" defaultValue={initial?.bin ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">e-TIN</span>
        <input name="tin" defaultValue={initial?.tin ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">Address</span>
        <input name="address" defaultValue={initial?.address ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">Division</span>
        <input name="division" defaultValue={initial?.division ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">District</span>
        <input name="district" defaultValue={initial?.district ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">Upazila</span>
        <input name="upazila" defaultValue={initial?.upazila ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      <label className="text-sm"><span className="mb-1 block">Union</span>
        <input name="union" defaultValue={initial?.union ?? ''} className="w-full rounded border px-2 py-1.5" /></label>
      {state.error && <p className="col-span-2 text-sm text-red-600" role="alert">{state.error}</p>}
      <div className="col-span-2"><Button type="submit" variant="default" disabled={pending}>{pending ? 'Saving…' : 'Save company'}</Button></div>
    </form>
  )
}
