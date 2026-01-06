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

        const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}`
        const response = await fetch(`${apiUrl}/api/auth/user`, {
          credentials: 'include',
        })

        if (response.ok) {
          const user = await response.json()
          set({ user, isLoading: false, error: null })
        } else {
          set({ user: null, isLoading: false, error: null })
        }
      } catch (error) {
        set({ user: null, isLoading: false, error: String(error) })
      }
    },

    logout: async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}`
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
