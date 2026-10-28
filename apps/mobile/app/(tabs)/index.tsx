import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { can } from '@neurobook/shared'
import { cacheAccounts, listAccounts, syncOutbox } from '../../src/db'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface Company {
  id: string
  name: string
  slug: string
  role: string
  member?: boolean
  current: boolean
}

export default function DashboardScreen() {
  const router = useRouter()
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [syncing, setSyncing] = useState(false)
  const [company, setCompany] = useState<string | null>(null)
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[] | null>(null)

  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState<Company | null>(null)
  const [password, setPassword] = useState('')
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  async function token() {
    const value = await SecureStore.getItemAsync('access_token')
    if (!value) router.replace('/login')
    return value
  }

  async function refresh() {
    const accessToken = await token()
    if (!accessToken) return
    setCompanyCode(await SecureStore.getItemAsync('tenant_slug'))

    try {
      const [meRes, accRes] = await Promise.all([
        fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`${API}/api/v1/accounts`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])

      if (meRes.status === 401 || accRes.status === 401) {
        await SecureStore.deleteItemAsync('access_token')
        router.replace('/login')
        return
      }

      if (meRes.ok) {
        const me = await meRes.json()
        if (me?.data?.tenantName) {
          setCompany(me.data.tenantName)
          setCompanyCode(me.data.tenantSlug ?? null)
          if (me.data.tenantSlug) await SecureStore.setItemAsync('tenant_slug', me.data.tenantSlug)
        }
        // Only ADMIN and MANAGER may move the session to another company.
        if (can(me?.data?.role, 'tenant:switch')) {
          const tenantsRes = await fetch(`${API}/api/v1/auth/tenants`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (tenantsRes.ok) {
            const json = await tenantsRes.json()
            setCompanies(json.data ?? [])
          }
        }
      }

      const json = await accRes.json()
      const accounts = json.data ?? []
      await cacheAccounts(accounts)
      setCount(accounts.length)
      setStatus('ok (cached)')
    } catch {
      const local = await listAccounts()
      setCount(local.length)
      setStatus('offline (cached)')
    }
  }

  async function sync() {
    setSyncing(true)
    const accessToken = await token()
    if (accessToken) await syncOutbox(accessToken, API)
    await refresh()
    setSyncing(false)
  }

  async function submitSwitch() {
    if (!target || password.length === 0) return
    setSwitching(true)
    setSwitchError(null)
    try {
      const accessToken = await token()
      if (!accessToken) return
      const res = await fetch(`${API}/api/v1/auth/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tenantSlug: target.slug, password }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setSwitchError(json?.error?.message ?? 'Could not switch company.')
        return
      }
      await SecureStore.setItemAsync('access_token', json.data.accessToken)
      if (json.data.tenant?.slug) await SecureStore.setItemAsync('tenant_slug', json.data.tenant.slug)
      closeSwitcher()
      setStatus('loading')
      await refresh()
    } catch {
      setSwitchError('Network error. Try again.')
    } finally {
      setSwitching(false)
    }
  }

  function closeSwitcher() {
    setPicking(false)
    setTarget(null)
    setPassword('')
    setSwitchError(null)
  }

  useEffect(() => {
    refresh()
  }, [])

  const canSwitch = (companies?.length ?? 0) > 1

  return (
    <View className="flex-1 gap-3.5 bg-slate-50 p-5 pt-14">
      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <View className="flex-row items-start justify-between gap-2.5">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Signed in to</Text>
          {canSwitch && (
            <Pressable
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              className="rounded-lg border border-gray-200 px-2.5 py-1 active:opacity-60"
            >
              <Text className="text-xs font-semibold text-brand">Switch</Text>
            </Pressable>
          )}
        </View>
        <Text className="mt-1 text-xl font-bold text-gray-900" numberOfLines={1}>
          {company ?? 'Loading company...'}
        </Text>
        {companyCode ? (
          <Text className="mt-1.5 self-start rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
            {companyCode}
          </Text>
        ) : null}
        <Text className="mt-2 text-xs text-gray-400">Every entry you create is scoped to this company.</Text>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-xl border border-gray-200 bg-white p-3.5">
          <Text className="text-[11px] font-semibold uppercase text-gray-400">Accounts</Text>
          <Text className="mt-1 text-[22px] font-bold text-gray-900">{count}</Text>
        </View>
        <View className="flex-1 rounded-xl border border-gray-200 bg-white p-3.5">
          <Text className="text-[11px] font-semibold uppercase text-gray-400">Status</Text>
          <Text className="mt-1 text-[13px] font-semibold text-gray-600">{status}</Text>
        </View>
      </View>

      <Pressable
        onPress={sync}
        disabled={syncing}
        accessibilityRole="button"
        className={`mt-auto items-center rounded-xl bg-brand py-3.5 active:opacity-70 ${syncing ? 'opacity-70' : ''}`}
      >
        {syncing ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-[15px] font-semibold text-white">Sync now</Text>
        )}
      </Pressable>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={closeSwitcher}>
        <View className="flex-1 items-center justify-center bg-slate-900/40 p-5">
          <View className="w-full rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-base font-bold text-gray-900">
              {target ? 'Confirm the switch' : 'Switch company'}
            </Text>

            {!target ? (
              <>
                <Text className="mt-1 text-xs text-gray-500">
                  Pick the company this session should use. Companies you do not belong to are open to admins with that
                  company&apos;s password.
                </Text>
                <View className="mt-3 max-h-80 gap-1.5">
                  {(companies ?? []).map((option) => (
                    <Pressable
                      key={option.id}
                      disabled={option.current}
                      onPress={() => {
                        setTarget(option)
                        setPassword('')
                        setSwitchError(null)
                      }}
                      accessibilityRole="button"
                      className={`rounded-xl border px-3 py-2.5 ${
                        option.current ? 'border-blue-200 bg-blue-50' : 'border-gray-200 active:bg-gray-50'
                      }`}
                    >
                      <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                        {option.name}
                      </Text>
                      <Text className="mt-0.5 font-mono text-[11px] text-gray-400">
                        {option.slug} · {option.member === false ? 'admin access' : option.role}
                        {option.current ? ' · current' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text className="mt-1 text-xs text-gray-500">
                  Enter {target.name}&apos;s company password. It belongs to the company, not to you.
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Company password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!switching}
                  onSubmitEditing={submitSwitch}
                  className="mt-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[15px] text-gray-900"
                />

                {switchError ? (
                  <View className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                    <Text className="text-xs text-red-700">{switchError}</Text>
                  </View>
                ) : null}

                <View className="mt-3 flex-row items-center justify-between gap-2">
                  <Pressable
                    onPress={() => {
                      setTarget(null)
                      setPassword('')
                      setSwitchError(null)
                    }}
                    disabled={switching}
                    accessibilityRole="button"
                    className="rounded-xl border border-gray-300 px-3 py-2.5 active:opacity-60"
                  >
                    <Text className="text-sm font-semibold text-gray-700">Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitSwitch}
                    disabled={switching || password.length === 0}
                    accessibilityRole="button"
                    className="flex-row items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2.5 active:opacity-70"
                  >
                    {switching && <ActivityIndicator color="#ffffff" size="small" />}
                    <Text className="text-sm font-semibold text-white">Switch</Text>
                  </Pressable>
                </View>
              </>
            )}

            <Pressable onPress={closeSwitcher} accessibilityRole="button" className="mt-3 items-center py-1">
              <Text className="text-xs font-semibold text-gray-400">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}
