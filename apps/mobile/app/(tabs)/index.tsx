import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function DashboardScreen() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('access_token')
      if (!token) { setStatus('not logged in'); return }
      try {
        const res = await fetch(`${API}/api/v1/accounts`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        setCount(json.data?.length ?? 0)
        setStatus('ok')
      } catch (e: any) {
        setStatus(e?.message ?? 'error')
      }
    })()
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Dashboard</Text>
      <Text>Accounts: {count}</Text>
      <Text>Status: {status}</Text>
    </View>
  )
}
