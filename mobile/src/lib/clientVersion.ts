// §6.3: parse X-Min-Client-Version / X-Recommended-Client-Version from
// every response. Hard block vs soft prompt.
import Constants from 'expo-constants'

const APP_VERSION: string = (Constants.expoConfig?.version as string | undefined) ?? '0.0.0'

export interface VersionGating {
  apiVersion: number
  minClientVersion: string
  recommendedClientVersion: string
  hardBlock: boolean
  softPrompt: boolean
}

export function evaluateVersionGating(headers: {
  'x-api-version'?: string
  'x-min-client-version'?: string
  'x-recommended-client-version'?: string
}): VersionGating {
  return {
    apiVersion: Number(headers['x-api-version'] ?? 1),
    minClientVersion: headers['x-min-client-version'] ?? '0.0.0',
    recommendedClientVersion: headers['x-recommended-client-version'] ?? '0.0.0',
    hardBlock: compareVersions(APP_VERSION, headers['x-min-client-version'] ?? '0.0.0') < 0,
    softPrompt: compareVersions(APP_VERSION, headers['x-recommended-client-version'] ?? '0.0.0') < 0,
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0)
  const pb = b.split('.').map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}
