'use client'

import { useEffect, useState, useRef } from 'react'

interface User {
  id: string
  email: string
  name: string
  plan: 'free' | 'basic' | 'professional' | 'enterprise'
  expiresAt: number | null
  paymentProvider: string | null
  disabled: boolean
}

/**
 * Hook для получения актуального пользователя из БД
 * Автоматически обновляет план каждые 10 секунд
 * Учитывает visibility state (не polling в скрытых табах)
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/user')
      if (response.ok) {
        const data = await response.json()
        setUser(data)
        setError(null)
      } else {
        setError('Failed to fetch user')
      }
    } catch (err) {
      console.error('[useUser] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Запускаем polling при монтировании
  useEffect(() => {
    // Инициальный fetch
    fetchUser()

    // Функция для запуска/остановки polling в зависимости от visibility
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(fetchUser, 10_000)
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
        fetchUser()
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

  return { user, loading, error }
}
