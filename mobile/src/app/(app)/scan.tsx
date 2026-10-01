// Camera OCR for receipt scanning (Phase 2). Uses expo-camera +
// expo-text-recognition. Detected text is forwarded to the new-voucher
// form pre-filled.
import { useState, useRef } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { getTextFromFrame } from 'expo-text-recognition'
import { useLocalSearchParams } from 'expo-router'
import { router } from 'expo-router'

export default function ScanScreen() {
  const { narration: prefill } = useLocalSearchParams<{ narration?: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const [pending, setPending] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  if (!permission) return <View />
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center">Camera permission required to scan receipts.</Text>
        <Pressable onPress={requestPermission} className="mt-4 rounded bg-black px-4 py-2">
          <Text className="text-white">Grant permission</Text>
        </Pressable>
      </View>
    )
  }

  async function capture() {
    if (!cameraRef.current) return
    setPending(true)
    try {
      // Capture with base64 so the OCR module can read the frame in-memory
      // without a second filesystem round-trip.
      const photo = await cameraRef.current.takePictureAsync({ base64: true })
      if (!photo?.base64) return
      const lines = await getTextFromFrame(photo.base64, true)
      const narration =
        (prefill ?? lines.join(' ').slice(0, 200)).trim() || undefined
      router.push({
        pathname: '/(app)/vouchers/new',
        params: narration ? { narration } : undefined,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View className="absolute inset-x-0 bottom-0 items-center pb-8">
        <Pressable onPress={capture} disabled={pending} className="rounded-full bg-white/90 p-5 shadow">
          {pending ? <ActivityIndicator /> : <Text>●</Text>}
        </Pressable>
      </View>
    </View>
  )
}
