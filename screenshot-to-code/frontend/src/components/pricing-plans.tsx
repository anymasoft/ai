"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Check, Loader2 } from "lucide-react"
import { cn } from '@/lib/utils'
import { fetchJSON } from "@/lib/api"

interface Tariff {
  key: string
  name: string
  price_rub: number
  credits: number
  is_active: boolean
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: string
  frequency: string
  credits: number
  features: string[]
  popular?: boolean
  current?: boolean
}

interface PricingPlansProps {
  plans?: PricingPlan[]
  mode?: 'pricing' | 'billing'
  currentPlanId?: string
  onPlanSelect?: (planId: string) => void
}

// Пакеты пополнения credits
const packages: Record<string, { name: string; description: string; buttonText: string; features: string[] }> = {
  free: {
    name: 'Free',
    description: 'Чтобы понять подход и качество результата',
    buttonText: 'Уже активно',
    features: [
      'Превращение скриншота в рабочий HTML',
      'Максимальное визуальное сходство с оригиналом',
      'Читаемая структура разметки',
      'Tailwind-классы вместо ручного CSS',
      'Живой предпросмотр в процессе создания',
      'Подходит для тестов и экспериментов',
      'Без подписок и обязательств',
    ],
  },
  basic: {
    name: 'Basic',
    description: 'Для небольших сайтов и MVP',
    buttonText: 'Купить 100 генераций',
    features: [
      'HTML / React / Vue — готовый код на выходе',
      'Быстрая сборка интерфейсов без ручной верстки',
      'Tailwind-классы, удобно дорабатывать вручную',
      'Экономия времени на типовых страницах',
      'Подходит для лендингов и внутренних сервисов',
      'Результат виден сразу, без ожидания финала',
      'Надёжная база для дальнейшей доработки',
    ],
  },
  professional: {
    name: 'Professional',
    description: 'Для регулярной и коммерческой работы',
    buttonText: 'Купить 500 генераций',
    features: [
      'Массовая генерация заготовок под проекты',
      'Быстрое клонирование существующих интерфейсов',
      'Экономия десятков часов ручной верстки',
      'Рабочий код, готовый к интеграции в проект',
      'Удобно для агентств и команд',
      'Подходит для коммерческих задач и клиентов',
      'Один инструмент вместо рутинной верстки',
    ],
  },
}

export function PricingPlans({
  mode = 'pricing',
  currentPlanId,
  onPlanSelect
}: PricingPlansProps) {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTariffs()
  }, [])

  async function fetchTariffs() {
    try {
      setLoading(true)
      const data = await fetchJSON<{ tariffs: Tariff[] }>("/api/billing/tariffs")
      setTariffs(data.tariffs || [])
      console.log("[PRICING] Loaded tariffs from API:", data.tariffs)
    } catch (error) {
      console.error("[PRICING] Error loading tariffs:", error)
      setTariffs([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Построить пакеты из данных пополнения
  const plans: PricingPlan[] = tariffs.map(tariff => ({
    id: tariff.key,
    name: packages[tariff.key]?.name || tariff.name,
    description: packages[tariff.key]?.description || tariff.name,
    price: tariff.price_rub === 0 ? '0' : tariff.price_rub.toString(),
    frequency: '₽',
    credits: tariff.credits,
    features: packages[tariff.key]?.features || [],
    popular: tariff.key === 'basic',
  }))

  // Show error if no tariffs are available
  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
        <p className="text-destructive font-medium">
          Тарифы недоступны. Обратитесь к администратору.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Если вы админ, проверьте, что тарифы инициализированы в БД.
        </p>
      </div>
    )
  }
  const getButtonText = (plan: PricingPlan) => {
    return packages[plan.id]?.buttonText || 'Купить'
  }

  const getButtonVariant = (plan: PricingPlan) => {
    return plan.popular ? 'default' as const : 'outline' as const
  }

  const isButtonDisabled = (plan: PricingPlan) => {
    // Все пакеты можно активировать/купить (разовые платежи)
    return false
  }

  return (
    <div className='grid gap-8 lg:grid-cols-3'>
      {plans.map(tier => (
        <Card
          key={tier.id}
          className={cn('flex flex-col pt-0', { 
            'border-primary relative shadow-lg': tier.popular,
            'border-primary': currentPlanId === tier.id && mode === 'billing'
          })}
          aria-labelledby={`${tier.id}-title`}
        >
          {tier.popular && (
            <div className='absolute start-0 -top-3 w-full'>
              <Badge className='mx-auto flex w-fit gap-1.5 rounded-full font-medium'>
                <Sparkles className='!size-4' />
                {mode === 'pricing' && (
                <span>Популярный</span>
                )}
                {currentPlanId === tier.id && mode === 'billing' && (
                  <span>Текущий тариф</span>
                )}
              </Badge>
            </div>
          )}
          <CardHeader className='space-y-2 pt-8 text-center'>
            <CardTitle id={`${tier.id}-title`} className='text-2xl'>
              {tier.name}
            </CardTitle>
            <p className='text-muted-foreground text-sm text-balance'>{tier.description}</p>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col space-y-6'>
            <div className='flex items-baseline justify-center gap-2'>
              <span className='text-4xl font-bold'>{tier.price}</span>
              <span className='text-muted-foreground text-sm font-medium'>{tier.frequency}</span>
            </div>
            <div className='text-center text-sm text-muted-foreground'>
              {tier.id === 'free'
                ? 'Включено: 3 генерации бесплатно для старта'
                : `Включено: ${tier.credits} генераций`
              }
            </div>
            <div className='space-y-2'>
              {tier.features.map(feature => (
                <div key={feature} className='flex items-center gap-2'>
                  <div className='bg-muted rounded-full p-1'>
                    <Check className='size-3.5' />
                  </div>
                  <span className='text-sm'>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className='w-full cursor-pointer'
              size='lg'
              variant={getButtonVariant(tier)}
              disabled={isButtonDisabled(tier)}
              onClick={() => onPlanSelect?.(tier.id)}
              aria-label={`${getButtonText(tier)} - ${tier.name} plan`}
            >
              {getButtonText(tier)}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
