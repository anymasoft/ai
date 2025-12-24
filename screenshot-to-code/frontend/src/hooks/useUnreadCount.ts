import { useState, useEffect } from "react"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:7001"

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

      const res = await fetch(`${BACKEND_URL}/api/admin/messages/unread-count`, {
        headers: {
          "X-Admin-Email": adminEmail,
        },
      })

      if (!res.ok) return

      const data = await res.json()
      setUnreadCount(data.count || 0)
    } catch (error) {
      console.error("Error fetching unread count:", error)
    }
  }

  return unreadCount
}
