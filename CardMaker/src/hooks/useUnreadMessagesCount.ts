import { useEffect, useState } from "react"

export function useUnreadMessagesCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        setIsLoading(true)
        const res = await fetch("/api/admin/messages/unread-count")
        if (!res.ok) throw new Error("Failed to fetch unread count")
        const data = await res.json()
        setUnreadCount(data.unreadCount || 0)
      } catch (error) {
        console.error("Error fetching unread count:", error)
      } finally {
        setIsLoading(false)
      }
    }

    // Загрузим только один раз при монтировании компонента
    fetchUnreadCount()
  }, [])

  return { unreadCount, isLoading }
}
