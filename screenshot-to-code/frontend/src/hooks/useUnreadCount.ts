import { useState, useEffect } from "react"
import { fetchJSON } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const email = useAuthStore((state) => state.email)
  const role = useAuthStore((state) => state.role)

  useEffect(() => {
    // Only poll if user is authenticated and is an admin
    if (!email || role !== "admin") {
      setUnreadCount(0)
      return
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 10000) // Poll every 10 seconds
    return () => clearInterval(interval)
  }, [email, role])

  async function fetchUnreadCount() {
    try {
      const data = await fetchJSON<{ count: number }>("/api/admin/messages/unread-count")
      setUnreadCount(data.count || 0)
    } catch (error) {
      console.error("Error fetching unread count:", error)
    }
  }

  return unreadCount
}
