import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AuthStore {
  email: string | null
  role: string | null
  setEmail: (email: string) => void
  setRole: (role: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      email: null,
      role: null,
      setEmail: (email: string) => set({ email }),
      setRole: (role: string) => set({ role }),
      logout: () => set({ email: null, role: null }),
    }),
    {
      name: "auth-store",
    }
  )
)
