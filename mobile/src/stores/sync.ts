import { create } from 'zustand'
import { pendingCount } from '@/sync/queue'

interface SyncState {
  pending: number
  lastSyncAt: number | null
  refresh: () => Promise<void>
  setLastSync: (ts: number) => void
}

export const useSyncStatus = create<SyncState>((set) => ({
  pending: 0,
  lastSyncAt: null,
  refresh: async () => {
    set({ pending: await pendingCount() })
  },
  setLastSync: (ts) => set({ lastSyncAt: ts }),
}))
