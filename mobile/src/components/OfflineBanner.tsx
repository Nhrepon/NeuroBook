// §15.3: sync state is visible to the user at all times. Pending count,
// last-synced time, per-item status. Never silent.
import { View, Text } from 'react-native'
import { useEffect } from 'react'
import { useSyncStatus } from '@/stores/sync'
import { processSyncQueue } from '@/sync/queue'

export function OfflineBanner() {
  const { pending, lastSyncAt, refresh, setLastSync } = useSyncStatus()

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (pending === 0 && lastSyncAt) return null
  return (
    <View className="bg-amber-100 px-3 py-2">
      <Text className="text-xs text-amber-900">
        {pending > 0 ? `${pending} pending` : 'Synced'}{lastSyncAt ? ` · last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
      </Text>
      <Text
        onPress={async () => {
          const { ok } = await processSyncQueue()
          if (ok > 0) setLastSync(Date.now())
          await refresh()
        }}
        className="mt-0.5 text-xs font-medium text-amber-900 underline"
      >
        Sync now
      </Text>
    </View>
  )
}
