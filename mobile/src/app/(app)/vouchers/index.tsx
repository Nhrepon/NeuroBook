import { View, Text, FlatList, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Pressable } from 'react-native'
import { api } from '@/api/client'
import { formatTakaFromMinor, formatDateBd } from '@neurobook/shared/format'

export default function VouchersListScreen() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['vouchers', 'list'],
    queryFn: async () => (await api.get('/api/v1/vouchers?limit=50')).data.data as Array<{
      id: string
      voucherType: string
      date: string
      totalDebit: number
      sequenceNumber: string | null
      status: string
    }>,
  })

  return (
    <View className="flex-1">
      <FlatList
        data={data ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/(app)/vouchers/[id]', params: { id: item.id } })}
            className="mb-2 rounded border border-gray-200 p-3 active:bg-gray-50"
          >
            <Text className="text-sm">{item.voucherType} · {formatDateBd(item.date)}</Text>
            <View className="mt-1 flex-row justify-between">
              <Text className="text-xs text-gray-500">{item.sequenceNumber ?? '(draft)'}</Text>
              <Text className="text-sm font-medium">{formatTakaFromMinor(item.totalDebit)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="py-12 text-center text-sm text-gray-500">No vouchers yet.</Text>
        }
      />
      <Pressable
        onPress={() => router.push('/(app)/vouchers/new')}
        className="absolute bottom-6 right-6 rounded-full bg-black px-5 py-3 shadow"
      >
        <Text className="text-white">+ New</Text>
      </Pressable>
    </View>
  )
}
