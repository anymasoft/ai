import { useEffect, useState } from "react"

export function useUnreadMessagesCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let intervalId: NodeJS.Timeout

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

    // Загрузим сразу
    fetchUnreadCount()

    // Затем будем polling каждые 10 секунд
    intervalId = setInterval(fetchUnreadCount, 10000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  return { unreadCount, isLoading }
}
