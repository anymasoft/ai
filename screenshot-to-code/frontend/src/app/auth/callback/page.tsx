import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const redirectTo = searchParams.get('redirect_to') || '/playground'
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] handleCallback called:', { success, error, redirectTo, hasOpener: !!window.opener })

      if (error) {
        console.log('[AuthCallback] error detected:', error)
        if (window.opener) {
          console.log('[AuthCallback] sending auth-error to opener')
          window.opener.postMessage(
            {
              type: 'auth-error',
              error: error,
            },
            window.location.origin
          )
          window.close()
        } else {
          window.location.href = '/auth/sign-in'
        }
        return
      }

      if (success === 'true') {
        console.log('[AuthCallback] success detected')
        if (window.opener) {
          // Popup: просто отправляем сообщение основному окну
          // Основное окно сделает checkAuth()
          console.log('[AuthCallback] in popup, sending auth-success to opener with redirectTo:', redirectTo)
          window.opener.postMessage(
            {
              type: 'auth-success',
              redirectTo: redirectTo,
            },
            window.location.origin
          )
          console.log('[AuthCallback] message sent, closing popup')
          window.close()
        } else {
          // Без popup: сами делаем checkAuth() и навигируем
          console.log('[AuthCallback] not in popup, calling checkAuth()')
          await checkAuth()
          window.location.href = redirectTo
        }
      }
    }

    handleCallback()
  }, [success, error, redirectTo, checkAuth])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-sm text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}

export default AuthCallbackPage
