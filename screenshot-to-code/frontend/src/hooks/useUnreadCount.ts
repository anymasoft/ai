import { useState, useEffect } from "react"
import { fetchJSON } from "@/lib/api"
import { useAdminStore } from "@/store/admin"

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const isAdmin = useAdminStore((state) => state.isAdmin)

  useEffect(() => {
    // Only poll if user is admin
    if (!isAdmin) {
      setUnreadCount(0)
      return
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 10000) // Poll every 10 seconds
    return () => clearInterval(interval)
  }, [isAdmin])

  async function fetchUnreadCount() {
    try {
      const data = await fetchJSON<{ count: number }>("/api/admin/messages/unread-count")
      setUnreadCount(data.count || 0)
    } catch (error) {
      setUnreadCount(0)
    }
  }

  return unreadCount
}
