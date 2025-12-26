import { create } from "zustand"
import { useAuthStore } from "./auth"

interface AdminStore {
  isAdmin: boolean
  setIsAdmin: (isAdmin: boolean) => void
  checkAdmin: () => void
}

export const useAdminStore = create<AdminStore>((set) => ({
  isAdmin: false,
  setIsAdmin: (isAdmin: boolean) => set({ isAdmin }),
  checkAdmin: () => {
    // Get admin status from user.role, no API call needed
    const user = useAuthStore.getState().user
    set({ isAdmin: user?.role === "admin" })
  },
}))
