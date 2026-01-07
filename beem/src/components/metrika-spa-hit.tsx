'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Компонент для отправки SPA pageview (hit) событий в Яндекс.Метрику
 * Срабатывает при каждом изменении pathname или searchParams
 * и отправляет полный URL (с параметрами) в Метрику
 */
export function MetrikaSpaHit() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Проверяем доступность window и window.ym
    if (typeof window === 'undefined') return

    const ym = (window as any).ym
    if (!ym || typeof ym !== 'function') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Метрика] window.ym не доступна')
      }
      return
    }

    // Собираем полный URL с параметрами
    const url = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname

    try {
      // Отправляем SPA-hit в Яндекс.Метрику
      ym(106161271, 'hit', url)

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Метрика] SPA-hit отправлен: ${url}`)
      }
    } catch (error) {
      console.error('[Метрика] Ошибка при отправке SPA-hit:', error)
    }
  }, [pathname, searchParams])

  return null
}
