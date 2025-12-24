import { useState, useEffect } from "react"
import { AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api"

export function BackendStatusBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    checkBackendStatus()
    const interval = setInterval(checkBackendStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  async function checkBackendStatus() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/health`, {
        method: "GET",
      })

      if (response.ok) {
        setIsOffline(false)
      } else {
        setIsOffline(true)
      }
    } catch (error) {
      setIsOffline(true)
    }
  }

  if (!isOffline || isDismissed) {
    return null
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <Alert variant="destructive" className="shadow-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          Backend недоступен
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription>
          Сервер на {getApiBaseUrl()} не отвечает. Проверьте, запущен ли backend.
        </AlertDescription>
      </Alert>
    </div>
  )
}
