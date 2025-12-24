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
      if (error) {
        if (window.opener) {
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
        if (window.opener) {
          // Ждём завершения checkAuth перед отправкой сообщения
          await checkAuth()
          window.opener.postMessage(
            {
              type: 'auth-success',
              redirectTo: redirectTo,
            },
            window.location.origin
          )
          window.close()
        } else {
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
