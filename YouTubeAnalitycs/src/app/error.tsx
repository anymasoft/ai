"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Логирование ошибки
    console.error("Global error caught:", error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950 px-4">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-full bg-red-50 dark:bg-red-950 p-4">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                  Something went wrong
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  We encountered an unexpected error. Please try again.
                </p>
              </div>

              {process.env.NODE_ENV === "development" && error.message && (
                <div className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-900 p-4 text-left">
                  <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-words">
                    {error.message}
                  </p>
                </div>
              )}

              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 px-6 py-2.5 text-sm font-medium text-white transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
