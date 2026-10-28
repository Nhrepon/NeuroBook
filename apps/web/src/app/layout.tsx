import Link from 'next/link'
import './globals.css'
import LogoutButton from '@/ui/LogoutButton'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="flex items-center gap-4 border-b border-gray-200 px-4 py-3">
          <Link href="/" className="font-semibold">Dashboard</Link>
          <Link href="/vouchers" className="hover:underline">Vouchers</Link>
          <Link href="/accounts" className="hover:underline">Accounts</Link>
          <Link href="/invoices" className="hover:underline">Invoices</Link>
          <Link href="/reports" className="hover:underline">Reports</Link>
          <Link href="/bank" className="hover:underline">Bank</Link>
          <Link href="/settings" className="hover:underline">Settings</Link>
          <span className="ml-auto"><LogoutButton /></span>
        </nav>
        {children}
      </body>
    </html>
  )
}
