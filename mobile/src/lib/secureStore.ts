// R17: tokens in OS keychain, never AsyncStorage.
import * as SecureStore from 'expo-secure-store'

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync('access_token', accessToken)
  await SecureStore.setItemAsync('refresh_token', refreshToken)
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('access_token')
  await SecureStore.deleteItemAsync('refresh_token')
}

export async function getAccessToken() {
  return SecureStore.getItemAsync('access_token')
}
