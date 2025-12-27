'use client'

import { useEffect, useSearchParams } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * OAuth Success Callback Page
 *
 * Это НЕ UI страница, это технический callback для OAuth popup.
 *
 * Flow:
 * 1. Backend редиректит popup → /oauth/success?redirect_to=...
 * 2. Этот компонент отправляет postMessage родителю
 * 3. Popup закрывается
 * 4. Родитель получает сообщение и делает redirect
 */
export default function OAuthSuccessPage() {
  const searchParams = useSearchParams()
  const navigate = useNavigate()
  const redirectTo = searchParams.get('redirect_to') || '/playground'

  useEffect(() => {
    // Если window.opener существует - это popup
    if (window.opener && !window.opener.closed) {
      // Отправляем сообщение родительскому окну
      window.opener.postMessage(
        {
          type: 'oauth-success',
          redirect_to: redirectTo,
        },
        window.location.origin // только для этого origin
      )

      // Закрываем popup через небольшую задержку
      // (чтобы постMessage был доставлен раньше закрытия)
      setTimeout(() => {
        window.close()
      }, 500)
    } else {
      // Если opener нет (например, пользователь открыл в новой вкладке)
      // просто редиректим на нужную страницу
      navigate(redirectTo)
    }
  }, [redirectTo, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-muted-foreground">Завершение входа...</p>
      </div>
    </div>
  )
}
