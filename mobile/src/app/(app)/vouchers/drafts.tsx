// §15.3 — drafts screen shows pending/synced/conflict status per item.
import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native'
import { db, initSchema } from '@/sync/db'
import { processSyncQueue } from '@/sync/queue'
import { router } from 'expo-router'

interface DraftRow {
  id: string
  voucher_type: string
  date: string
  narration: string
  total_debit: number
  total_credit: number
  status: 'draft' | 'synced' | 'conflict'
  server_id: string | null
}

export default function DraftsScreen() {
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    await initSchema()
    const r = await db.getAllAsync<DraftRow>(
      `SELECT * FROM vouchers_drafts ORDER BY updated_at DESC LIMIT 100`,
    )
    setRows(r)
  }

  useEffect(() => { void load() }, [])

  async function syncNow() {
    setPending(true)
    try {
      const { ok, failed } = await processSyncQueue()
      Alert.alert('Sync', `${ok} ok, ${failed} failed`)
      await load()
    } finally {
      setPending(false)
    }
  }

  if (!rows) return <ActivityIndicator className="m-6" />
  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-gray-200 p-3">
        <Text className="text-sm">{rows.length} draft{rows.length === 1 ? '' : 's'}</Text>
        <Pressable onPress={syncNow} disabled={pending} className="rounded border border-gray-300 px-3 py-1">
          <Text className="text-sm">{pending ? 'Syncing…' : 'Sync now'}</Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/(app)/vouchers/[id]', params: { id: item.server_id ?? item.id } })}
            className="mb-2 rounded border border-gray-200 p-3"
          >
            <Text className="text-sm">{item.voucher_type} · {item.date}</Text>
            <Text className="mt-1 text-xs text-gray-500">{item.narration}</Text>
            <View className="mt-1 flex-row justify-between">
              <Text className={`text-xs ${statusColor(item.status)}`}>{item.status}</Text>
              <Text className="text-xs text-gray-500">{(item.total_debit / 100).toFixed(2)} ৳</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="py-12 text-center text-sm text-gray-500">No drafts yet.</Text>
        }
      />
    </View>
  )
}

function statusColor(s: DraftRow['status']): string {
  return s === 'synced' ? 'text-green-600' : s === 'conflict' ? 'text-red-600' : 'text-amber-600'
}
