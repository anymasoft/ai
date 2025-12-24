import { useState, useEffect } from "react"
import { fetchJSON, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const email = useAuthStore((state) => state.email)

  useEffect(() => {
    // Only poll if user is authenticated
    if (!email) {
      setUnreadCount(0)
      return
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 10000) // Poll every 10 seconds
    return () => clearInterval(interval)
  }, [email])

  async function fetchUnreadCount() {
    try {
      const data = await fetchJSON<{ count: number }>("/api/admin/messages/unread-count")
      setUnreadCount(data.count || 0)
    } catch (error) {
      // If 403, user is not admin - silently set count to 0
      if (error instanceof ApiError && error.status === 403) {
        setUnreadCount(0)
      }
    }
  }

  return unreadCount
}
