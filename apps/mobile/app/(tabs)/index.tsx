import { useEffect, useState } from 'react'
import { Text, View, Pressable } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { getDb, cacheAccounts, listAccounts, syncOutbox } from '../../src/db'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function DashboardScreen() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [syncing, setSyncing] = useState(false)

  async function refresh() {
    const token = await SecureStore.getItemAsync('access_token')
    if (!token) { setStatus('not logged in'); return }
    try {
      const res = await fetch(`${API}/api/v1/accounts`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      const accounts = json.data ?? []
      await cacheAccounts(accounts)
      setCount(accounts.length)
      setStatus('ok (cached)')
    } catch (e: any) {
      const local = await listAccounts()
      setCount(local.length)
      setStatus('offline (cached)')
    }
  }

  async function sync() {
    setSyncing(true)
    const token = await SecureStore.getItemAsync('access_token')
    if (token) await syncOutbox(token, API)
    await refresh()
    setSyncing(false)
  }

  useEffect(() => { refresh() }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Dashboard</Text>
      <Text>Accounts: {count}</Text>
      <Text>Status: {status}</Text>
      <Pressable onPress={sync} style={{ backgroundColor: '#2563eb', padding: 10, borderRadius: 8 }}>
        <Text style={{ color: 'white' }}>{syncing ? 'Syncing...' : 'Sync'}</Text>
      </Pressable>
    </View>
  )
}
