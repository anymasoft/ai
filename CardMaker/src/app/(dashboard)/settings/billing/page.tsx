'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PricingPlans } from "@/components/pricing-plans"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import { useCheckPaymentStatus } from "@/hooks/useCheckPaymentStatus"

interface UsageInfo {
  balance: number
  used: number
}

export default function BillingSettings() {
  const { data: session, status } = useSession()
  const checkResult = useCheckPaymentStatus()
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)

  // Получаем информацию о балансе описаний
  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoadingUsage(false)
      return
    }

    const fetchUsage = async () => {
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
      } finally {
        setIsLoadingUsage(false)
      }
    }

    fetchUsage()
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
            <PricingPlans
              mode="billing"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
