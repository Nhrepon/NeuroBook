import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-[hsl(var(--background))] p-4 ${className}`}>{children}</div>
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">{children}</div>
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold">{children}</h3>
}

export function CardValue({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-2xl font-semibold">{children}</p>
}
