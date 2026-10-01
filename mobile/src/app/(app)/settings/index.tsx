import { View, Text, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { clearTokens } from '@/lib/secureStore'

export default function SettingsScreen() {
  return (
    <View className="flex-1 p-4">
      <Text className="text-lg font-semibold">Settings</Text>
      <Pressable
        onPress={async () => {
          await clearTokens()
          Alert.alert('Signed out')
          router.replace('/(auth)/login')
        }}
        className="mt-4 rounded border border-red-300 py-2"
      >
        <Text className="text-center text-red-600">Sign out</Text>
      </Pressable>
    </View>
  )
}
