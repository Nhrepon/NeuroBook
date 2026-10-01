import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// ISR for the static report shells. Hourly rebuild.
export const revalidate = 3600

export async function generateStaticParams() {
  return [
    { slug: 'trial-balance' },
    { slug: 'profit-loss' },
    { slug: 'balance-sheet' },
  ]
}

const TITLES: Record<string, string> = {
  'trial-balance': 'Trial Balance',
  'profit-loss': 'Profit & Loss',
  'balance-sheet': 'Balance Sheet',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return { title: TITLES[slug] ?? 'Report' }
}

export default async function StaticReportPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!(slug in TITLES)) notFound()
  return (
    <article>
      <h1 className="text-xl font-semibold">{TITLES[slug]}</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Period selector and rendered report go here.
      </p>
    </article>
  )
}
