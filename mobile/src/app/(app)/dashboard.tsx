import { View, Text, FlatList, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { formatTakaFromMinor, formatDateBd } from '@neurobook/shared/format'

export default function DashboardScreen() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['vouchers', 'recent'],
    queryFn: async () => (await api.get('/api/v1/vouchers?limit=10')).data.data as Array<{
      id: string
      date: string
      voucherType: string
      totalDebit: number
      status: string
    }>,
  })

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(v) => v.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      ListHeaderComponent={
        <Text className="mb-3 text-lg font-semibold">Recent vouchers</Text>
      }
      renderItem={({ item }) => (
        <View className="mb-2 rounded border border-gray-200 p-3">
          <Text className="text-sm">{item.voucherType} · {formatDateBd(item.date)}</Text>
          <Text className="text-base font-medium">{formatTakaFromMinor(item.totalDebit)}</Text>
          <Text className="mt-1 text-xs text-gray-500">{item.status}</Text>
        </View>
      )}
      ListEmptyComponent={
        <Text className="py-12 text-center text-sm text-gray-500">No vouchers yet.</Text>
      }
    />
  )
}
