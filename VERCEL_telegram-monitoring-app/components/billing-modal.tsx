"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BillingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: string
}

type PricingCardProps = {
  isYearly?: boolean
  title: string
  monthlyPrice?: number
  yearlyPrice?: number
  description: string
  features: string[]
  actionLabel: string
  popular?: boolean
  exclusive?: boolean
  currentPlan: string
}

const CheckItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3">
    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
    <span className="text-sm">{text}</span>
  </div>
)

const PricingCard = ({
  isYearly,
  title,
  monthlyPrice,
  yearlyPrice,
  description,
  features,
  actionLabel,
  popular,
  exclusive,
  currentPlan,
}: PricingCardProps) => (
  <Card
    className={cn(
      "relative",
      popular && "border-primary shadow-lg scale-105",
      exclusive && "border-purple-200 bg-gradient-to-b from-purple-50 to-white",
    )}
  >
    {popular && (
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
        <Badge className="bg-primary text-primary-foreground">Популярный</Badge>
      </div>
    )}
    {exclusive && (
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
        <Badge className="bg-purple-600 text-white">Эксклюзивный</Badge>
      </div>
    )}

    <CardHeader className="text-center pb-8">
      <CardTitle className="text-2xl">{title}</CardTitle>
      {isYearly && yearlyPrice && monthlyPrice ? (
        <div>
          <div className="text-4xl font-bold">₽{yearlyPrice}</div>
          <div className="text-sm text-muted-foreground">/год</div>
          <Badge variant="secondary" className="mt-2">
            Экономия ₽{monthlyPrice * 12 - yearlyPrice}
          </Badge>
        </div>
      ) : (
        <div>
          <div className="text-4xl font-bold">{monthlyPrice ? `₽${monthlyPrice}` : "Индивидуально"}</div>
          {monthlyPrice && <div className="text-sm text-muted-foreground">/месяц</div>}
        </div>
      )}
      <CardDescription className="text-balance">{description}</CardDescription>
    </CardHeader>

    <CardContent className="space-y-4">
      {features.map((feature: string, index: number) => (
        <CheckItem key={index} text={feature} />
      ))}
    </CardContent>

    <CardFooter>
      <Button
        className="w-full"
        variant={popular ? "default" : "outline"}
        disabled={currentPlan === title.toLowerCase()}
      >
        {currentPlan === title.toLowerCase() ? "Текущий план" : actionLabel}
      </Button>
    </CardFooter>
  </Card>
)

export function BillingModal({ open, onOpenChange, currentPlan }: BillingModalProps) {
  const [isYearly, setIsYearly] = useState(false)
  const togglePricingPeriod = (value: string) => setIsYearly(Number.parseInt(value) === 1)

  const plans = [
    {
      title: "Базовый",
      monthlyPrice: 990,
      yearlyPrice: 9900,
      description: "Основные функции для начала работы",
      features: ["До 10 каналов", "До 50 ключевых слов", "История за 30 дней", "Базовая аналитика"],
      actionLabel: "Начать",
    },
    {
      title: "Pro",
      monthlyPrice: 2490,
      yearlyPrice: 24900,
      description: "Идеально для владельцев малого и среднего бизнеса",
      features: [
        "До 100 каналов",
        "Неограниченные ключевые слова",
        "История за 90 дней",
        "Расширенная аналитика",
        "Все типы уведомлений",
        "Telegram бот",
      ],
      actionLabel: "Начать",
      popular: true,
    },
    {
      title: "Enterprise",
      description: "Выделенная поддержка и инфраструктура под ваши потребности",
      features: [
        "Неограниченные каналы",
        "Неограниченные ключевые слова",
        "Полная история",
        "Продвинутая аналитика",
        "API доступ",
        "Белый лейбл",
      ],
      actionLabel: "Связаться с отделом продаж",
      exclusive: true,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-4 pb-8">
          <DialogTitle className="text-4xl font-bold">Тарифные планы</DialogTitle>
          <DialogDescription className="text-xl">Выберите план, который подходит именно вам</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center mb-8">
          <Tabs value={isYearly ? "1" : "0"} onValueChange={togglePricingPeriod}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="0">Ежемесячно</TabsTrigger>
              <TabsTrigger value="1">Ежегодно</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <PricingCard
              key={plan.title}
              isYearly={isYearly}
              title={plan.title}
              monthlyPrice={plan.monthlyPrice}
              yearlyPrice={plan.yearlyPrice}
              description={plan.description}
              features={plan.features}
              actionLabel={plan.actionLabel}
              popular={plan.popular}
              exclusive={plan.exclusive}
              currentPlan={currentPlan}
            />
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground space-y-1">
          <p>Все планы включают 14-дневный бесплатный период</p>
          <p>Отмена в любое время • Безопасные платежи • Поддержка 24/7</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
