import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh bg-[hsl(var(--background))]">{children}</main>
}
