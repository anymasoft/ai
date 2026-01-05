'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import { PackageSelector } from "@/components/package-selector"
import { useCheckPaymentStatus } from "@/hooks/useCheckPaymentStatus"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface UsageInfo {
  balance: number
  used: number
}

interface Payment {
  id: string
  userId: string
  email: string
  packageKey: string
  packageTitle: string
  generations: number
  amount: number
  status: string
  createdAt: number
}

export default function BillingSettings() {
  const { data: session } = useSession()
  const checkResult = useCheckPaymentStatus()
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [isCheckingPayment, setIsCheckingPayment] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)

  // Получаем информацию о балансе описаний
  const fetchUsageInfo = async () => {
    try {
      const response = await fetch("/api/billing/script-usage", {
        cache: "no-store",
      })
      if (response.ok) {
        const data = await response.json()
        setUsageInfo(data)
      } else {
        setUsageInfo({
          balance: 0,
          used: 0,
        })
      }
    } catch (error) {
      console.error("[BillingPage] Ошибка при получении баланса:", error)
      setUsageInfo({
        balance: 0,
        used: 0,
      })
    }
  }

  // Загружаем платежи пользователя
  const fetchPayments = async () => {
    try {
      setIsLoadingPayments(true)
      const response = await fetch("/api/admin/payments", {
        cache: "no-store",
      })
      if (response.ok) {
        const data = await response.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("[BillingPage] Ошибка при загрузке платежей:", error)
    } finally {
      setIsLoadingPayments(false)
    }
  }

  // Инициальная загрузка баланса
  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoadingUsage(false)
      return
    }

    fetchUsageInfo()
    fetchPayments()
    setIsLoadingUsage(false)
  }, [session?.user?.id])

  // Polling для проверки статуса платежа после возврата из YooKassa
  useEffect(() => {
    if (!session?.user?.id) return

    const searchParams = new URLSearchParams(window.location.search)
    const isSuccess = searchParams.get("success") === "1"

    if (!isSuccess) return

    let pollingCount = 0
    const maxPolls = 15
    let interval: NodeJS.Timeout | null = null
    let hasSucceeded = false

    setIsCheckingPayment(true)

    const stopPolling = () => {
      if (interval) clearInterval(interval)
      setIsCheckingPayment(false)
    }

    const pollPaymentStatus = async () => {
      if (hasSucceeded) return

      pollingCount++

      try {
        const response = await fetch("/api/payments/yookassa/check", {
          cache: "no-store",
        })

        const data = await response.json()

        console.log(`[BillingPage] Payment check (poll ${pollingCount}):`, data)

        // Если платёж прошёл успешно
        if (data.success && data.status === "succeeded") {
          console.log("[BillingPage] Payment succeeded! Updating balance...")
          hasSucceeded = true

          // Обновляем баланс и платежи
          await fetchUsageInfo()
          await fetchPayments()

          toast.success("Оплата прошла успешно! Баланс обновлён.")

          // Очищаем URL от параметра success
          window.history.replaceState({}, "", window.location.pathname)

          stopPolling()
          return
        }

        // Если ещё pending и не превышен лимит попыток
        if (!data.success && data.status === "pending" && pollingCount < maxPolls) {
          // Продолжаем polling
          return
        }

        // Если превышен лимит попыток
        if (pollingCount >= maxPolls) {
          toast.info(
            "Платёж всё ещё обрабатывается. Баланс обновится автоматически в течение минуты."
          )
          window.history.replaceState({}, "", window.location.pathname)
          stopPolling()
          return
        }

        // Другие ошибки (но не "No pending payment found" - это нормально)
        if (data.error && !data.error.includes("No pending payment")) {
          toast.error(data.error)
          window.history.replaceState({}, "", window.location.pathname)
          stopPolling()
        }
      } catch (error) {
        console.error("[BillingPage] Payment check error:", error)

        if (pollingCount >= maxPolls) {
          toast.error("Не удалось проверить статус платежа")
          window.history.replaceState({}, "", window.location.pathname)
          stopPolling()
        }
      }
    }

    // Первая проверка сразу
    pollPaymentStatus()

    // Дальше polling каждые 2 секунды
    interval = setInterval(() => {
      if (pollingCount < maxPolls && !hasSucceeded) {
        pollPaymentStatus()
      } else {
        stopPolling()
      }
    }, 2000)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [session?.user?.id])

  const isLoading = isLoadingUsage

  // Если данные ещё загружаются, показываем прогресс
  if (isLoading) {
    return (
      <div className="space-y-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">Биллинг</h1>
          <p className="text-muted-foreground">
            Управляйте своей подпиской и информацией о биллинге.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold">Биллинг</h1>
        <p className="text-muted-foreground">
          Управляйте своей подпиской и информацией о биллинге.
        </p>
      </div>

      {isCheckingPayment && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700">
              ⏳ Ожидаем подтверждение оплаты…
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <CurrentPlanCard
          balance={usageInfo?.balance || 0}
          used={usageInfo?.used || 0}
        />
        <Card>
          <CardHeader>
            <CardTitle>История платежей</CardTitle>
            <CardDescription>
              Последние покупки пакетов описаний
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Платежи отсутствуют
              </p>
            ) : (
              <div className="space-y-4">
                {payments.slice(0, 5).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-start justify-between p-3 border rounded-lg text-sm"
                  >
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">
                        {payment.packageTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.generations} описаний
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(
                          payment.createdAt * 1000
                        ).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-semibold">
                        {payment.amount} ₽
                      </p>
                      <Badge
                        variant={
                          payment.status === "succeeded"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {payment.status === "succeeded"
                          ? "Успешно"
                          : "Ожидание"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Доступные пакеты описаний</CardTitle>
            <CardDescription>
              Выберите пакет, который вам подойдёт.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PackageSelector />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
