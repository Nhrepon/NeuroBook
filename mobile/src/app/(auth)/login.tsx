import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { api } from '@/api/client'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setPending(true)
    setError(null)
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password })
      await import('@/lib/secureStore').then((m) => m.saveTokens(data.accessToken, data.refreshToken))
      router.replace('/(app)/dashboard')
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Sign-in failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <View className="flex-1 justify-center px-6">
      <Text className="text-2xl font-semibold">NeuroBook</Text>
      <Text className="mt-1 text-sm text-gray-500">Sign in to your account</Text>

      <View className="mt-6 space-y-3">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          className="rounded border border-gray-300 px-3 py-2"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          className="rounded border border-gray-300 px-3 py-2"
        />
        {error && <Text className="text-sm text-red-600">{error}</Text>}
        <Pressable
          onPress={submit}
          disabled={pending}
          className="rounded bg-black py-3 active:opacity-80"
        >
          {pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-white">Sign in</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}
