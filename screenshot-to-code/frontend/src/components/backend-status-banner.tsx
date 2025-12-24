import { useState, useEffect } from "react"
import { AlertCircle, X } from "lucide-react"
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
      <div className="bg-destructive text-destructive-foreground border border-destructive rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Backend недоступен</h3>
              <button
                onClick={() => setIsDismissed(true)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive-foreground/10 transition-colors"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm opacity-90">
              Сервер на {getApiBaseUrl()} не отвечает. Проверьте, запущен ли backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
