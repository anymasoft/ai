import { useState, useEffect } from "react"
import { fetchJSON } from "@/lib/api"

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchUnreadCount() {
    try {
      const adminEmail = localStorage.getItem("dev_admin_email")
      if (!adminEmail) return

      const data = await fetchJSON<{ count: number }>("/api/admin/messages/unread-count", {
        headers: {
          "X-Admin-Email": adminEmail,
        },
      })

      setUnreadCount(data.count || 0)
    } catch (error) {
      console.error("Error fetching unread count:", error)
    }
  }

  return unreadCount
}
