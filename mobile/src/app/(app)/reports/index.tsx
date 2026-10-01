import { View, Text, FlatList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { formatTakaFromMinor } from '@neurobook/shared/format'

export default function ReportsScreen() {
  const tb = useQuery({
    queryKey: ['report', 'trial-balance'],
    queryFn: async () => (await api.get('/api/v1/reports/trial-balance')).data.data as Array<{
      account: { code: string; name: string }
      debit: number
      credit: number
    }>,
  })

  return (
    <FlatList
      data={tb.data ?? []}
      keyExtractor={(r) => r.account.code}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={<Text className="mb-3 text-lg font-semibold">Trial balance</Text>}
      renderItem={({ item }) => (
        <View className="mb-2 flex-row justify-between border-b border-gray-100 py-1">
          <Text className="text-sm">{item.account.code} — {item.account.name}</Text>
          <View className="flex-row gap-4">
            <Text className="text-sm">{formatTakaFromMinor(item.debit)}</Text>
            <Text className="text-sm">{formatTakaFromMinor(item.credit)}</Text>
          </View>
        </View>
      )}
    />
  )
}
