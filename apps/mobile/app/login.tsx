import { useState } from 'react'
import { Text, TextInput, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error?.message ?? 'login failed'); return }
      await SecureStore.setItemAsync('access_token', json.data.accessToken)
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e?.message ?? 'network error')
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>NeuroBook</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <Pressable onPress={submit} style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Login</Text>
      </Pressable>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  )
}
