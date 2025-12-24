import { create } from "zustand"
import { fetchJSON, ApiError } from "@/lib/api"

interface AdminStore {
  isAdmin: boolean
  setIsAdmin: (isAdmin: boolean) => void
  checkAdmin: () => Promise<void>
}

export const useAdminStore = create<AdminStore>((set) => ({
  isAdmin: false,
  setIsAdmin: (isAdmin: boolean) => set({ isAdmin }),
  checkAdmin: async () => {
    try {
      await fetchJSON<{ count: number }>("/api/admin/messages/unread-count")
      set({ isAdmin: true })
    } catch (error) {
      // 401 or any other error means not admin
      set({ isAdmin: false })
    }
  },
}))
