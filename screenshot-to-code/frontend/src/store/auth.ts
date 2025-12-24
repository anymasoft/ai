import { create } from 'zustand'

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  plan: 'free' | 'basic' | 'professional'
  disabled: boolean
  expiresAt: number | null
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null

  setUser: (user: User | null) => void
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  (set) => ({
    user: null,
    isLoading: true,
    error: null,

    setUser: (user) => set({ user, isLoading: false }),

    checkAuth: async () => {
      try {
        set({ isLoading: true })

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:7001'
        console.log('[checkAuth] fetching user from', apiUrl)
        const response = await fetch(`${apiUrl}/api/auth/user`, {
          credentials: 'include',
        })

        console.log('[checkAuth] response status:', response.status)
        if (response.ok) {
          const user = await response.json()
          console.log('[checkAuth] user loaded:', user)
          set({ user, isLoading: false, error: null })
        } else {
          console.log('[checkAuth] not authenticated, response:', response.status)
          set({ user: null, isLoading: false, error: null })
        }
      } catch (error) {
        console.error('[checkAuth] error:', error)
        set({ user: null, isLoading: false, error: String(error) })
      }
    },

    logout: async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:7001'
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        })
      } catch (error) {
        console.error('Logout failed:', error)
      } finally {
        set({ user: null })
      }
    },
  })
)
