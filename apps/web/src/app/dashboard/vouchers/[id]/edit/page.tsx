'use client'

import { useParams } from 'next/navigation'
import VoucherForm from '@/ui/VoucherForm'

export default function EditVoucherPage() {
  const id = useParams()?.id as string
  return <VoucherForm mode="edit" voucherId={id} />
}
