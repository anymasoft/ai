'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import { PackageSelector } from "@/components/package-selector"
import { useCheckPaymentStatus } from "@/hooks/useCheckPaymentStatus"
import { toast } from "sonner"

interface UsageInfo {
  balance: number
  used: number
}

export default function BillingSettings() {
  const { data: session } = useSession()
  const checkResult = useCheckPaymentStatus()
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [isCheckingPayment, setIsCheckingPayment] = useState(false)

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

  // Инициальная загрузка баланса
  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoadingUsage(false)
      return
    }

    fetchUsageInfo()
    setIsLoadingUsage(false)
  }, [session?.user?.id])

  // Polling для проверки статуса платежа после возврата из YooKassa
  useEffect(() => {
    if (!session?.user?.id) return

    const searchParams = new URLSearchParams(window.location.search)
    const isSuccess = searchParams.get("success") === "1"

    if (!isSuccess) return

    let pollingCount = 0
    const maxPolls = 15 // 15 * 2 сек = 30 сек максимум

    setIsCheckingPayment(true)

    const pollPaymentStatus = async () => {
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

          // Обновляем баланс
          await fetchUsageInfo()

          setIsCheckingPayment(false)
          toast.success("Оплата прошла успешно! Баланс обновлён.")

          // Очищаем URL от параметра success
          window.history.replaceState({}, "", window.location.pathname)

          return
        }

        // Если ещё pending и не превышен лимит попыток
        if (!data.success && data.status === "pending" && pollingCount < maxPolls) {
          // Продолжаем polling
          return
        }

        // Если превышен лимит попыток или ошибка
        if (pollingCount >= maxPolls) {
          setIsCheckingPayment(false)
          toast.info(
            "Платёж всё ещё обрабатывается. Баланс обновится автоматически в течение минуты."
          )
          window.history.replaceState({}, "", window.location.pathname)
          return
        }

        // Другие ошибки
        setIsCheckingPayment(false)
        toast.error(data.error || "Ошибка при проверке платежа")
        window.history.replaceState({}, "", window.location.pathname)
      } catch (error) {
        console.error("[BillingPage] Payment check error:", error)

        if (pollingCount >= maxPolls) {
          setIsCheckingPayment(false)
          toast.error("Не удалось проверить статус платежа")
          window.history.replaceState({}, "", window.location.pathname)
        }
      }
    }

    // Первая проверка сразу
    pollPaymentStatus()

    // Дальше polling каждые 2 секунды
    const interval = setInterval(() => {
      if (pollingCount < maxPolls) {
        pollPaymentStatus()
      } else {
        clearInterval(interval)
        setIsCheckingPayment(false)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [session?.user?.id])

  const isLoading = isLoadingUsage

  // Если данные ещё загружаются, показываем прогресс
  if (isLoading) {
    return (
      <div className="space-y-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">Описания и биллинг</h1>
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
        <h1 className="text-3xl font-bold">Описания и биллинг</h1>
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
        <BillingHistoryCard />
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
