import { redirect } from 'next/navigation'

/**
 * Tax rates moved into Settings with the rest of the accounting configuration.
 * This keeps old bookmarks and links working.
 */
export default function TaxRatesPage() {
  redirect('/dashboard/settings#tax-rates')
}
