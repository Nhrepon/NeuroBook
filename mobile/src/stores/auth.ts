import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  setAccessToken: (t: string | null) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ accessToken: null }),
}))
