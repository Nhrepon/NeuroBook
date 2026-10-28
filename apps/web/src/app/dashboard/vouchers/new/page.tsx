import { VoucherTypeSchema } from '@neurobook/shared'
import VoucherForm from '@/ui/VoucherForm'

export default async function NewVoucherPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const parsed = VoucherTypeSchema.safeParse(type)

  return <VoucherForm mode="create" initialType={parsed.success ? parsed.data : undefined} />
}