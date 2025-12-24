"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { fetchJSON } from "@/lib/api"

interface BalanceResponse {
  user_id: string
  credits: number
  message: string
}

interface CheckoutResponse {
  db_payment_id: string
  confirmation_url: string
  package: string
  credits_amount: number
  amount_rubles: number
}

const PACKAGES = {
  free: {
    name: "Free",
    credits: 3,
    description: "Для ознакомления с платформой",
    price: "0 ₽",
  },
  basic: {
    name: "Basic",
    credits: 100,
    description: "Разовая покупка",
    features: ["100 генераций", "1 генерация = 1 credit", "Без подписки"],
    price: "3 000 ₽",
  },
  professional: {
    name: "Professional",
    credits: 500,
    description: "Для активного использования",
    features: ["500 генераций", "1 генерация = 1 credit", "Подходит для агентств и команд"],
    price: "14 000 ₽",
  },
}

export default function BillingSettings() {
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    fetchBalance()
  }, [])

  async function fetchBalance() {
    try {
      setLoading(true)
      const data = await fetchJSON<BalanceResponse>("/api/billing/balance")
      setCredits(data.credits)
      setError(null)
    } catch (err) {
      console.error("[BILLING] Error fetching balance:", err)
      setError("Не удалось загрузить информацию о кредитах")
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase(packageName: string) {
    try {
      setPurchasing(packageName)

      const response = await fetchJSON<CheckoutResponse>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ package: packageName }),
      })

      // Redirect to YooKassa payment page
      if (response.confirmation_url) {
        window.location.href = response.confirmation_url
      }
    } catch (err) {
      console.error("[BILLING] Error creating payment:", err)
      alert(`Ошибка при создании платежа. Попробуйте позже.`)
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <>
      <div className="space-y-8 px-4 lg:px-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Покупка генераций</h1>
          <p className="text-muted-foreground">
            Выберите пакет генераций, который вам нужен.
          </p>
        </div>

        {/* Current Balance */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ваш текущий баланс</p>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {loading ? "..." : credits}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {credits === 0
                    ? "У вас нет доступных генераций"
                    : `Вы можете сделать ${credits} генерацию${credits % 10 === 1 && credits !== 11 ? "" : "й"}`}
                </p>
              </div>
              <Button
                onClick={fetchBalance}
                variant="outline"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Cards */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          {/* Free Plan */}
          <Card>
            <CardHeader>
              <CardTitle>{PACKAGES.free.name}</CardTitle>
              <CardDescription>{PACKAGES.free.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Генераций</p>
                <p className="text-3xl font-bold">{PACKAGES.free.credits}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{PACKAGES.free.price}</p>
                <p className="text-xs text-muted-foreground">Вам уже доступно</p>
              </div>
              <Button disabled className="w-full">
                Текущий тариф
              </Button>
            </CardContent>
          </Card>

          {/* Basic Plan */}
          <Card className="border-blue-200 ring-1 ring-blue-200">
            <CardHeader>
              <CardTitle>{PACKAGES.basic.name}</CardTitle>
              <CardDescription>{PACKAGES.basic.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Генераций</p>
                <p className="text-3xl font-bold">{PACKAGES.basic.credits}</p>
              </div>
              <div className="space-y-3">
                {PACKAGES.basic.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => handlePurchase("basic")}
                disabled={purchasing === "basic" || loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {purchasing === "basic" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {PACKAGES.basic.price}
              </Button>
            </CardContent>
          </Card>

          {/* Professional Plan */}
          <Card>
            <CardHeader>
              <CardTitle>{PACKAGES.professional.name}</CardTitle>
              <CardDescription>{PACKAGES.professional.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Генераций</p>
                <p className="text-3xl font-bold">{PACKAGES.professional.credits}</p>
              </div>
              <div className="space-y-3">
                {PACKAGES.professional.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => handlePurchase("professional")}
                disabled={purchasing === "professional" || loading}
                className="w-full"
              >
                {purchasing === "professional" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {PACKAGES.professional.price}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle>Часто задаваемые вопросы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium text-sm">Что такое генерация?</p>
              <p className="text-sm text-muted-foreground">
                Одна генерация = создание кода из одного скриншота или URL. Каждая генерация расходует ровно 1 кредит.
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">Могу ли я вернуть деньги?</p>
              <p className="text-sm text-muted-foreground">
                Кредиты не сгорают и не имеют срока действия. Вы можете использовать их когда угодно.
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">Есть ли подписка?</p>
              <p className="text-sm text-muted-foreground">
                Нет! Все пакеты — разовые покупки без автоматического продления.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
