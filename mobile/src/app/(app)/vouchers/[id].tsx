import { View, Text, ActivityIndicator, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, router } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { api } from '@/api/client'
import { formatTakaFromMinor, formatDateBd } from '@neurobook/shared/format'

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['voucher', id],
    queryFn: async () => (await api.get(`/api/v1/vouchers/${id}`)).data.data as {
      id: string
      voucherType: string
      narration: string
      date: string
      status: string
      totalDebit: number
      sequenceNumber: string | null
      lines: Array<{ accountId: string; debit: number; credit: number }>
    },
    enabled: !!id,
  })

  async function reverse() {
    // R20: biometric step-up before void/reverse.
    const ok = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm reversal' })
    if (!ok.success) return
    await api.post(`/api/v1/vouchers/${id}/reverse`, { reason: 'mobile reverse' })
    router.back()
  }

  if (isLoading) return <ActivityIndicator className="m-6" />
  if (!data) return <Text className="m-6">Voucher not found.</Text>

  return (
    <View className="flex-1 p-4">
      <Text className="text-lg font-semibold">{data.voucherType}</Text>
      <Text className="text-sm text-gray-500">{formatDateBd(data.date)} · {data.status}</Text>
      <Text className="mt-1 text-sm">{data.narration}</Text>
      <Text className="mt-2 text-base font-medium">{formatTakaFromMinor(data.totalDebit)}</Text>

      <Text className="mt-4 font-semibold">Lines</Text>
      {data.lines.map((l, i) => (
        <View key={i} className="mt-1 flex-row justify-between border-b border-gray-100 py-1">
          <Text className="text-sm">{l.accountId}</Text>
          <View className="flex-row gap-4">
            <Text className="text-sm">{formatTakaFromMinor(l.debit)}</Text>
            <Text className="text-sm">{formatTakaFromMinor(l.credit)}</Text>
          </View>
        </View>
      ))}

      {data.status === 'posted' && (
        <Pressable onPress={reverse} className="mt-6 rounded border border-red-300 py-2">
          <Text className="text-center text-red-600">Reverse (biometric required)</Text>
        </Pressable>
      )}
    </View>
  )
}
