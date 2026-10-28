import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { cacheVouchers, listVouchers, type CachedVoucher } from '../../src/db'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: '#fef3c7', text: '#92400e', label: 'Draft' },
  posted: { bg: '#d1fae5', text: '#065f46', label: 'Posted' },
  reversed: { bg: '#fee2e2', text: '#991b1b', label: 'Reversed' },
}

function typeLabel(type: string | null) {
  if (!type) return 'Voucher'
  const words = type.toLowerCase().split('_')
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function VouchersScreen() {
  const router = useRouter()
  const [rows, setRows] = useState<CachedVoucher[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true)
      setError(null)

      const token = await SecureStore.getItemAsync('access_token')
      if (!token) {
        router.replace('/login')
        return
      }

      try {
        const res = await fetch(`${API}/api/v1/vouchers`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401) {
          await SecureStore.deleteItemAsync('access_token')
          router.replace('/login')
          return
        }
        if (!res.ok) throw new Error('Could not load vouchers')

        const json = await res.json()
        const list: CachedVoucher[] = (json.data ?? []).map((v: any) => ({
          id: v.id,
          date: v.date,
          narration: v.narration,
          voucherType: v.voucherType ?? null,
          status: v.status ?? 'draft',
          sequenceNumber: v.sequenceNumber ?? null,
        }))
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        await cacheVouchers(list)
        setRows(list)
        setOffline(false)
      } catch {
        const cached = await listVouchers()
        cached.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setRows(cached)
        setOffline(true)
        if (cached.length === 0) setError('No connection and nothing cached yet.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [router],
  )

  useEffect(() => {
    load()
  }, [load])

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between px-5 pb-4 pt-14">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Vouchers</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            {rows.length} {rows.length === 1 ? 'voucher' : 'vouchers'}
            {offline ? ' · showing saved copy' : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => load('refresh')}
          disabled={refreshing}
          accessibilityRole="button"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 active:opacity-60"
        >
          <Text className="text-[13px] font-semibold text-brand">{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="items-center justify-center gap-2 py-10">
          <ActivityIndicator color="#2563eb" />
          <Text className="text-center text-[13px] text-gray-400">Loading vouchers...</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerClassName={rows.length === 0 ? 'grow justify-center p-6' : 'gap-2.5 px-4 pb-6'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="#2563eb" />}
          ListHeaderComponent={
            error ? (
              <Text className="mb-2.5 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-700">{error}</Text>
            ) : undefined
          }
          ListEmptyComponent={
            <View className="items-center justify-center gap-2 py-10">
              <Text className="text-base font-semibold text-gray-900">No vouchers yet</Text>
              <Text className="text-center text-[13px] text-gray-400">
                Post an entry from the web app and pull to refresh.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = STATUS_STYLE[item.status] ?? STATUS_STYLE.draft
            return (
              <View className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                <View className="flex-row items-center justify-between gap-2.5">
                  <Text className="flex-1 text-sm font-semibold text-gray-900" numberOfLines={1}>
                    {item.sequenceNumber ?? typeLabel(item.voucherType)}
                  </Text>
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
                    <Text className="text-[11px] font-semibold" style={{ color: badge.text }}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1.5 text-[13px] leading-[18px] text-gray-600" numberOfLines={2}>
                  {item.narration}
                </Text>
                <View className="mt-2.5 flex-row justify-between">
                  <Text className="text-[11px] text-gray-400">{typeLabel(item.voucherType)}</Text>
                  <Text className="text-[11px] text-gray-400">{formatDate(item.date)}</Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}
