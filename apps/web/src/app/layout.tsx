import './globals.css'

export const metadata = {
  title: 'NeuroBook',
  description: 'Accounting platform for Bangladesh',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
