"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function CompetitorsErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Competitors error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="rounded-full bg-amber-50 dark:bg-amber-950 p-3">
        <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Competitors Error
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Failed to load competitors. Please try refreshing.
        </p>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="w-full max-w-lg rounded-lg bg-zinc-100 dark:bg-zinc-900 p-3 text-left">
          <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all">
            {error.message}
          </p>
        </div>
      )}

      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  )
}
