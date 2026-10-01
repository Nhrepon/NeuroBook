// R20 wrapper — invoke the OS biometric prompt before running an action.
// The server-side action ALSO requires a step-up token; this is the
// client-side half of the gate.
import * as LocalAuthentication from 'expo-local-authentication'
import { Alert } from 'react-native'

export async function withBiometric(prompt: string, action: () => Promise<void>) {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const enrolled = await LocalAuthentication.isEnrolledAsync()
  if (!hasHardware || !enrolled) {
    Alert.alert('Biometric unavailable', 'Please enrol Face ID / fingerprint to continue.')
    return
  }
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: prompt })
  if (!res.success) {
    Alert.alert('Authentication failed')
    return
  }
  await action()
}
