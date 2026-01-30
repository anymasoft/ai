"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconCheck, IconArrowLeft } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

const plans = {
  monthly: [
    {
      name: "Базовый",
      price: "990",
      description: "Основные функции для начала мониторинга",
      features: ["До 5 каналов", "До 10 ключевых слов", "Базовая аналитика", "Email уведомления", "История за 30 дней"],
      popular: false,
      buttonText: "Начать",
    },
    {
      name: "Pro",
      price: "2490",
      description: "Идеально для малого и среднего бизнеса",
      features: [
        "До 50 каналов",
        "Неограниченные ключевые слова",
        "Расширенная аналитика",
        "Telegram + Email уведомления",
        "История за 1 год",
        "API доступ",
        "Экспорт данных",
      ],
      popular: true,
      buttonText: "Перейти на Pro",
    },
    {
      name: "Enterprise",
      price: "Индивидуально",
      description: "Персональная поддержка и инфраструктура под ваши нужды",
      features: [
        "Неограниченные каналы",
        "Неограниченные ключевые слова",
        "Полная аналитика + BI",
        "Все виды уведомлений",
        "Неограниченная история",
        "Приоритетная поддержка",
        "Персональный менеджер",
        "Интеграции на заказ",
      ],
      popular: false,
      buttonText: "Связаться с нами",
    },
  ],
  yearly: [
    {
      name: "Базовый",
      price: "9990",
      originalPrice: "11880",
      description: "Основные функции для начала мониторинга",
      features: ["До 5 каналов", "До 10 ключевых слов", "Базовая аналитика", "Email уведомления", "История за 30 дней"],
      popular: false,
      buttonText: "Начать",
    },
    {
      name: "Pro",
      price: "24990",
      originalPrice: "29880",
      description: "Идеально для малого и среднего бизнеса",
      features: [
        "До 50 каналов",
        "Неограниченные ключевые слова",
        "Расширенная аналитика",
        "Telegram + Email уведомления",
        "История за 1 год",
        "API доступ",
        "Экспорт данных",
      ],
      popular: true,
      buttonText: "Перейти на Pro",
    },
    {
      name: "Enterprise",
      price: "Индивидуально",
      description: "Персональная поддержка и инфраструктура под ваши нужды",
      features: [
        "Неограниченные каналы",
        "Неограниченные ключевые слова",
        "Полная аналитика + BI",
        "Все виды уведомлений",
        "Неограниченная история",
        "Приоритетная поддержка",
        "Персональный менеджер",
        "Интеграции на заказ",
      ],
      popular: false,
      buttonText: "Связаться с нами",
    },
  ],
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState("monthly")
  const router = useRouter()

  const handlePlanSelect = (planName: string) => {
    localStorage.setItem("selectedPlan", planName.toLowerCase())

    // Имитация процесса оплаты
    if (planName === "Enterprise") {
      // Для Enterprise плана показываем контактную форму
      alert("Спасибо за интерес! Наш менеджер свяжется с вами в течение 24 часов.")
    } else {
      // Для других планов имитируем успешную оплату
      alert(`Поздравляем! Вы успешно подключили тариф "${planName}". Добро пожаловать!`)
    }

    // Возвращаемся в дашборд
    router.push("/dashboard")
  }

  const currentPlans = plans[billingCycle as keyof typeof plans]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="pt-4 px-6 flex justify-between items-center">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="flex items-center gap-2">
          <IconArrowLeft className="h-4 w-4" />
          Вернуться в дашборд
        </Button>
      </nav>

      <div className="py-8 px-6">
        {/* Title Section */}
        <section className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Тарифные планы</h1>
          <p className="text-xl text-muted-foreground">Выберите план, который подходит именно вам</p>
        </section>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <Tabs value={billingCycle} onValueChange={setBillingCycle} className="w-40">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="monthly" className="text-base">
                Месяц
              </TabsTrigger>
              <TabsTrigger value="yearly" className="text-base">
                Год
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {billingCycle === "yearly" && (
          <div className="text-center mb-6">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Экономьте до 16% при годовой оплате
            </Badge>
          </div>
        )}

        {/* Pricing Cards */}
        <section className="flex flex-col lg:flex-row justify-center gap-8 max-w-7xl mx-auto">
          {currentPlans.map((plan, index) => (
            <Card
              key={plan.name}
              className={`w-full lg:w-80 flex flex-col justify-between relative ${
                plan.popular ? "border-primary shadow-lg scale-105" : "border-border"
              } ${plan.name === "Enterprise" ? "bg-gradient-to-br from-background to-muted/50" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">Популярный</Badge>
                </div>
              )}

              <div>
                <CardHeader className="pb-6 pt-6">
                  <CardTitle className="text-lg font-semibold text-foreground">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {plan.price === "Индивидуально" ? plan.price : `₽${plan.price}`}
                    </span>
                    {plan.price !== "Индивидуально" && (
                      <span className="text-sm text-muted-foreground">
                        /{billingCycle === "monthly" ? "мес" : "год"}
                      </span>
                    )}
                  </div>
                  {plan.originalPrice && (
                    <div className="text-sm text-muted-foreground">
                      <span className="line-through">₽{plan.originalPrice}</span>
                      <span className="ml-2 text-green-600 font-medium">
                        Скидка{" "}
                        {Math.round((1 - Number.parseInt(plan.price) / Number.parseInt(plan.originalPrice)) * 100)}%
                      </span>
                    </div>
                  )}
                  <CardDescription className="pt-1.5 h-8 text-sm">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="pt-0 flex flex-col gap-1.5">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center gap-2">
                      <IconCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-foreground">{feature}</span>
                    </div>
                  ))}
                </CardContent>
              </div>

              <CardFooter className="pt-4">
                <Button
                  className={`w-full relative overflow-hidden ${
                    plan.popular ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/80"
                  }`}
                  onClick={() => handlePlanSelect(plan.name)}
                >
                  {plan.popular && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/40 animate-pulse" />
                  )}
                  <span className="relative z-10">{plan.buttonText}</span>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>

        {/* Additional Info */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Все планы включают 14-дневный бесплатный период. Отмена в любое время.</p>
          <p className="mt-2">
            Нужна помощь с выбором?{" "}
            <Button variant="link" className="p-0 h-auto text-sm">
              Свяжитесь с нами
            </Button>
          </p>
        </div>
      </div>
    </div>
  )
}
