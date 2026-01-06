import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'

export function SignInPage() {
  const navigate = useNavigate()
  const { checkAuth } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const popupCheckInterval = useRef<NodeJS.Timeout | null>(null)

  // Слушаем сообщения от popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Проверяем, что сообщение пришло с правильного источника
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data.type === 'auth-success') {
        // Вызываем checkAuth() в основном окне
        await checkAuth()

        setIsLoading(false)
        setError(null)

        // Закрываем polling
        if (popupCheckInterval.current) {
          clearInterval(popupCheckInterval.current)
        }

        // Перейти на нужную страницу
        navigate(event.data.redirectTo)
      } else if (event.data.type === 'auth-error') {
        setIsLoading(false)
        setError(event.data.error)

        // Закрываем polling
        if (popupCheckInterval.current) {
          clearInterval(popupCheckInterval.current)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [navigate, checkAuth])

  // Cleanup для polling при размонтировании компонента
  useEffect(() => {
    return () => {
      if (popupCheckInterval.current) {
        clearInterval(popupCheckInterval.current)
      }
    }
  }, [])

  const handleGoogleSignIn = () => {
    setIsLoading(true)
    setError(null)

    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}`
    const popup = window.open(
      `${apiUrl}/api/oauth/google?redirect_to=/playground`,
      'google-signin',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    popupRef.current = popup

    if (!popup) {
      // Если popup был заблокирован, перенаправляем через главное окно
      window.location.href = `${apiUrl}/api/oauth/google?redirect_to=/playground`
      return
    }

    // Polling для проверки, закрыл ли пользователь popup вручную (не закончив OAuth)
    popupCheckInterval.current = setInterval(() => {
      if (popup.closed) {
        setIsLoading(false)
        setError('Окно входа было закрыто')
        if (popupCheckInterval.current) {
          clearInterval(popupCheckInterval.current)
        }
      }
    }, 1000)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        {/* Brand Block */}
        <a
          href="/"
          className="block pt-6 pb-4 text-center hover:opacity-80 transition-opacity"
        >
          <div className="flex flex-col items-center gap-2">
            <img
              src="/logo/logo-sidebar.webp"
              alt="Screen2Code"
              className="h-8 w-8"
            />
            <span className="text-lg font-semibold text-foreground">
              Screen2Code
            </span>
          </div>
        </a>

        <div className="h-px bg-border mx-6" />

        <CardHeader className="text-center">
          <CardTitle>Вход</CardTitle>
          <CardDescription>Войдите через Google аккаунт</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded border border-red-200">
              {error}
            </div>
          )}
          <Button
            variant="outline"
            className="w-full"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 mr-2 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Вход в систему...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5 mr-2"
                >
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                </svg>
                Продолжить с Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default SignInPage
