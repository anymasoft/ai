import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { fetchJSON } from "@/lib/api"

interface PaymentStatusResponse {
  status: "pending" | "succeeded" | "canceled"
  credits?: number
  message: string
}

export default function BillingReturn() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const paymentId = searchParams.get("payment_id")

  console.error("[BILLING] /billing mounted. paymentId:", paymentId)

  const [status, setStatus] = useState<"pending" | "succeeded" | "canceled" | "error">("pending")
  const [message, setMessage] = useState("Проверяем статус платежа...")
  const [credits, setCredits] = useState<number | null>(null)
  const [polling, setPolling] = useState(true)
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    if (!paymentId) {
      setStatus("error")
      setMessage("Платёж не найден. ID платежа отсутствует.")
      setPolling(false)
      return
    }

    const pollStatus = async () => {
      try {
        console.error("[BILLING] polling GET /api/billing/status?payment_id=" + paymentId)
        const response = await fetchJSON<PaymentStatusResponse>(
          `/api/billing/status?payment_id=${paymentId}`
        )
        console.error("[BILLING] fetchJSON returned successfully")

        console.error("[BILLING] response:", JSON.stringify(response))
        setMessage(response.message)

        if (response.status === "succeeded") {
          console.error("[BILLING] payment succeeded! credits:", response.credits)
          setStatus("succeeded")
          setCredits(response.credits || null)
          setPolling(false)

          // Auto-redirect after 2 seconds
          console.error("[BILLING] scheduling redirect to /settings/billing")
          setTimeout(() => {
            console.error("[BILLING] redirect to /settings/billing")
            navigate("/settings/billing")
          }, 2000)
          return
        } else if (response.status === "canceled") {
          console.error("[BILLING] payment canceled")
          setStatus("canceled")
          setPolling(false)
          return
        }
        // pending - continue polling
        console.error("[BILLING] still pending, continue polling")

        setPollCount((c) => c + 1)
      } catch (err) {
        console.error("[BILLING] Error checking status:", err)
        setMessage("Ошибка при проверке статуса. Попробуем снова...")
        setPollCount((c) => c + 1)
      }
    }

    // Poll immediately
    console.error("[BILLING] About to call pollStatus()")
    pollStatus()

    // Set interval for polling (every 2-3 seconds)
    if (polling) {
      const interval = setInterval(pollStatus, 2500)

      // Stop polling after 5 minutes
      const timeout = setTimeout(() => {
        setPolling(false)
        setStatus("error")
        setMessage("Истёк таймаут проверки статуса. Обратитесь в поддержку.")
      }, 5 * 60 * 1000)

      return () => {
        clearInterval(interval)
        clearTimeout(timeout)
      }
    }
  }, [paymentId, polling])

  const handleContinue = () => {
    navigate("/settings/billing")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {status === "pending" && (
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-400" />
            )}
            {status === "succeeded" && (
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
            )}
            {status === "canceled" && (
              <XCircle className="h-16 w-16 text-red-600 dark:text-red-400" />
            )}
            {status === "error" && (
              <AlertCircle className="h-16 w-16 text-yellow-600 dark:text-yellow-400" />
            )}
          </div>

          {/* Status Title */}
          <h2 className="text-2xl font-bold text-center mb-2">
            {status === "pending" && "Обработка платежа..."}
            {status === "succeeded" && "Спасибо за покупку!"}
            {status === "canceled" && "Платёж отменён"}
            {status === "error" && "Ошибка"}
          </h2>

          {/* Status Message */}
          <p className="text-center text-muted-foreground mb-6">
            {message}
          </p>

          {/* Credits Added */}
          {status === "succeeded" && credits && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <p className="text-center text-sm text-muted-foreground">
                Вам добавлено генераций
              </p>
              <p className="text-center text-3xl font-bold text-green-600 dark:text-green-400">
                +{credits}
              </p>
            </div>
          )}

          {/* Poll Count (for debugging) */}
          {status === "pending" && (
            <p className="text-center text-xs text-muted-foreground mb-6">
              Попыток проверки: {pollCount}
            </p>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {status === "succeeded" && (
              <>
                <Button
                  onClick={handleContinue}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Перейти к генерации
                </Button>
                <Button
                  onClick={() => navigate("/settings/billing")}
                  variant="outline"
                  className="w-full"
                >
                  Вернуться в биллинг
                </Button>
              </>
            )}

            {status === "canceled" && (
              <Button
                onClick={() => navigate("/settings/billing")}
                variant="outline"
                className="w-full"
              >
                Вернуться к выбору пакета
              </Button>
            )}

            {(status === "pending" || status === "error") && (
              <p className="text-xs text-center text-muted-foreground">
                {status === "pending"
                  ? "Страница будет обновляться автоматически..."
                  : "Пожалуйста, обратитесь в поддержку если проблема сохраняется."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
