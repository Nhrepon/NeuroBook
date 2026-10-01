import { Tabs } from 'expo-router'
import { OfflineBanner } from '@/components/OfflineBanner'
import { View } from 'react-native'

export default function AppTabs() {
  return (
    <View className="flex-1">
      <OfflineBanner />
      <Tabs screenOptions={{ headerShown: true }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="vouchers/index" options={{ title: 'Vouchers' }} />
        <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
        <Tabs.Screen name="reports/index" options={{ title: 'Reports' }} />
        <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  )
}
