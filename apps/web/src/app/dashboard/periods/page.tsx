import { redirect } from 'next/navigation'

/** Fiscal periods now live inside /dashboard/settings. */
export default function PeriodsPage() {
  redirect('/dashboard/settings')
}
