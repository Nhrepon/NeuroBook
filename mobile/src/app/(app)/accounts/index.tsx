import { View, Text, FlatList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

export default function AccountsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => (await api.get('/api/v1/accounts')).data.data as Array<{
      id: string
      code: string
      name: string
      type: string
    }>,
  })

  if (isLoading) return <Text className="p-4">Loading…</Text>
  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View className="mb-2 rounded border border-gray-200 p-3">
          <Text className="font-mono text-xs">{item.code}</Text>
          <Text className="text-sm font-medium">{item.name}</Text>
          <Text className="text-xs text-gray-500">{item.type}</Text>
        </View>
      )}
    />
  )
}
