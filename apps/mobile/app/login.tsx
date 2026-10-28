import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function LoginScreen() {
  const router = useRouter()
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0 && !busy,
    [email, password, busy],
  )

  async function submit() {
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim().toLowerCase() || undefined,
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not sign in.')
        return
      }
      await SecureStore.setItemAsync('access_token', json.data.accessToken)
      if (json.data.tenant?.slug) {
        await SecureStore.setItemAsync('tenant_slug', json.data.tenant.slug)
      }
      router.replace('/(tabs)')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'mb-3.5 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[15px] text-gray-900'

  return (
    <KeyboardAvoidingView className="flex-1 bg-slate-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerClassName="grow justify-center p-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand">
            <Text className="text-base font-bold text-white">NB</Text>
          </View>
          <View>
            <Text className="text-lg font-bold text-gray-900">NeuroBook</Text>
            <Text className="text-xs text-gray-400">Accounting for Bangladesh</Text>
          </View>
        </View>

        <View className="rounded-2xl border border-gray-200 bg-white p-5">
          <Text className="text-[22px] font-bold text-gray-900">Sign in</Text>
          <Text className="mt-1.5 mb-4 text-[13px] leading-5 text-gray-600">
            Use the account your admin created. The company code is only needed when your email belongs to more than
            one company.
          </Text>

          <Text className="mb-1.5 text-[13px] font-semibold text-gray-900">Company code</Text>
          <TextInput
            value={company}
            onChangeText={setCompany}
            placeholder="demo"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="organization"
            editable={!busy}
            className={inputClass}
          />

          <Text className="mb-1.5 text-[13px] font-semibold text-gray-900">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busy}
            returnKeyType="next"
            className={inputClass}
          />

          <Text className="mb-1.5 text-[13px] font-semibold text-gray-900">Password</Text>
          <View className="flex-row items-center rounded-xl border border-gray-300 bg-white px-3">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={submit}
              className="flex-1 py-2.5 text-[15px] text-gray-900"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Text className="pl-2 text-[13px] font-semibold text-brand">{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {error ? (
            <View className="mt-1 mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <Text className="text-[13px] text-red-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            className={`mt-3 items-center justify-center rounded-xl py-3.5 ${
              canSubmit ? 'bg-brand active:bg-brand-dark' : 'bg-brand opacity-50'
            }`}
          >
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text className="text-[15px] font-semibold text-white">Sign in</Text>}
          </Pressable>

          <Text className="mt-3.5 text-xs leading-[18px] text-gray-400">
            Sessions stay on this device until you sign out. Vouchers created offline sync when the connection returns.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}