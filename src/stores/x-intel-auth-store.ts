import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface XAuthState {
  bearerToken: string | null
  setBearerToken: (token: string) => void
  clearBearerToken: () => void
}

export const useXAuthStore = create<XAuthState>()(
  persist(
    (set) => ({
      bearerToken: null,
      setBearerToken: (token) => set({ bearerToken: token }),
      clearBearerToken: () => set({ bearerToken: null }),
    }),
    { name: 'x-intel-auth' },
  ),
)
