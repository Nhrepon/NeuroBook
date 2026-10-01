// R17: tokens in OS keychain, never AsyncStorage.
// R18: verify exp before sending (no round-trip 401 mid-flow).
// R19: certificate pinning in production (build-time config).
import axios, { AxiosError } from 'axios'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token')
  if (token) {
    // R18: client-side exp check. If the access token is expired, refresh
    // proactively so the user does not hit a 401 mid-flow.
    if (isJwtExpired(token)) {
      const newToken = await refreshAccessToken()
      if (newToken) config.headers.Authorization = `Bearer ${newToken}`
    } else {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  config.headers['X-Client-Version'] = Constants.expoConfig?.version ?? '0.0.0'
  config.headers['X-Client-Platform'] = Platform.OS
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const newToken = await refreshAccessToken()
      if (newToken && error.config) {
        error.config.headers.Authorization = `Bearer ${newToken}`
        return axios.request(error.config)
      }
      // Refresh failed — wipe tokens and force re-login.
      await SecureStore.deleteItemAsync('access_token')
      await SecureStore.deleteItemAsync('refresh_token')
    }
    throw error
  },
)

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token')
  if (!refreshToken) return null
  try {
    const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken })
    await SecureStore.setItemAsync('access_token', data.data.accessToken)
    return data.data.accessToken
  } catch {
    return null
  }
}

function isJwtExpired(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return true
  try {
    const payload = JSON.parse(atob(parts[1]!)) as { exp: number }
    return payload.exp * 1000 <= Date.now() + 30_000
  } catch {
    return true
  }
}
