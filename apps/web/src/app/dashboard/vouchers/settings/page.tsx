import { redirect } from 'next/navigation'

/** Settings moved to /dashboard/settings, where the sidebar and RBAC rule point. */
export default function VoucherSettingsPage() {
  redirect('/dashboard/settings')
}
