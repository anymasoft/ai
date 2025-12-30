'use client'

import { useEffect, useState, useRef } from 'react'

interface AdminUser {
  id: string
  email: string
  name: string | null
  plan: string
  expiresAt: number | null
  createdAt: number
  disabled: boolean
  analysesUsed: number
  scriptsUsed: number
  lastActive: number | null
}

/**
 * Hook для получения актуального списка пользователей в админке
 * Автоматически обновляет список каждые 10 секунд
 * Учитывает visibility state (не polling в скрытых табах)
 */
export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setError(null)
      } else {
        setError('Failed to fetch users')
      }
    } catch (err) {
      console.error('[useAdminUsers] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Запускаем polling при монтировании
  useEffect(() => {
    // Инициальный fetch
    fetchUsers()

    // Функция для запуска/остановки polling в зависимости от visibility
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(fetchUsers, 10_000)
    }

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    // Запускаем polling
    startPolling()

    // Слушаем изменения visibility (tab скрыт/видим)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // При возврате в активный tab - сразу fetch + запускаем polling
        fetchUsers()
        startPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup при размонтировании
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopPolling()
    }
  }, [])

  // Функция для ручного обновления
  const refresh = async () => {
    await fetchUsers()
  }

  return { users, loading, error, refresh }
}
