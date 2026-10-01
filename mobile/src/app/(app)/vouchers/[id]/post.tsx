// Mobile post flow. R21: requires connectivity. R20: biometric step-up.
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import * as LocalAuthentication from 'expo-local-authentication'
import { postVoucher } from '@/api/vouchers'

export default function PostVoucherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPost() {
    setError(null)
    // R21: must be online to post.
    const net = await NetInfo.fetch()
    if (!net.isConnected) {
      setError('Posting requires connectivity. Try again when online.')
      return
    }
    // R20: biometric step-up before post is allowed.
    const bio = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm posting voucher',
    })
    if (!bio.success) {
      setError('Authentication required.')
      return
    }

    setPending(true)
    try {
      await postVoucher(id)
      router.back()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to post.')
    } finally {
      setPending(false)
    }
  }

  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-lg font-semibold">Post voucher?</Text>
      <Text className="mt-2 text-center text-sm text-gray-500">
        Posting assigns the legal sequence number and is irreversible. Confirm with biometrics.
      </Text>
      {error && <Text className="mt-3 text-sm text-red-600">{error}</Text>}
      <Pressable onPress={onPost} disabled={pending} className="mt-6 rounded bg-black px-6 py-3">
        {pending ? <ActivityIndicator color="#fff" /> : <Text className="text-white">Post</Text>}
      </Pressable>
    </View>
  )
}
