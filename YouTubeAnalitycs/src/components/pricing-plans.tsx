"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Check, Loader2 } from "lucide-react"
import { cn } from '@/lib/utils'
import { useState } from "react"

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: string
  frequency: string
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

const defaultPlans: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Для начинающих авторов',
    price: '990 ₽',
    frequency: '/ месяц',
    features: ['До 30 AI-сценариев в месяц', 'Генерация сценариев по любым YouTube-видео', 'Готовая структура сценария: захват внимания → развитие → финал', 'История всех сгенерированных сценариев', 'Подходит для личных каналов и первых запусков'],
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Для растущих каналов',
    price: '2 490 ₽',
    frequency: '/ месяц',
    features: [
      'До 100 AI-сценариев в месяц',
      'Подходит для регулярного выпуска контента',
      'Удобно тестировать идеи и форматы видео',
      'Один инструмент для всех сценариев канала',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Для студий и команд',
    price: '5 990 ₽',
    frequency: '/ месяц',
    features: [
      'До 300 AI-сценариев в месяц',
      'Подходит для агентств и продакшн-команд',
      'Коммерческое использование сценариев',
      'Большие объёмы контента в одном аккаунте',
    ],
  },
]

export function PricingPlans({
  plans = defaultPlans,
  mode = 'pricing',
  currentPlanId,
  onPlanSelect
}: PricingPlansProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async (planId: string) => {
    try {
      setError(null);
      setLoadingPlanId(planId);

      // Отправляем запрос на создание платежа
      const response = await fetch('/api/payments/yookassa/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!data.success || !data.paymentUrl) {
        setError(data.error || 'Ошибка при создании платежа');
        return;
      }

      // Перенаправляем пользователя на страницу оплаты ЮKassa
      window.location.href = data.paymentUrl;
    } catch (err) {
      console.error('Payment error:', err);
      setError('Ошибка подключения к платежной системе');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const getButtonText = (plan: PricingPlan) => {
    // Если это текущий план - показываем "Текущий план"
    if (currentPlanId === plan.id && mode === 'billing') {
      return 'Текущий план'
    }

    // Для режима billing показываем "Оплатить"
    if (mode === 'billing' && currentPlanId !== plan.id) {
      return 'Оплатить'
    }

    // Кнопки для разных тарифов (для режима pricing)
    if (plan.id === 'basic') {
      return 'Сгенерировать сценарий'
    } else if (plan.id === 'professional') {
      return 'Создавать сценарии регулярно'
    } else if (plan.id === 'enterprise') {
      return 'Использовать в работе'
    }

    return 'Начать'
  }

  const getButtonVariant = (plan: PricingPlan) => {
    if (mode === 'billing' && currentPlanId === plan.id) {
      return 'outline' as const
    }
    return plan.popular ? 'default' as const : 'outline' as const
  }

  const isButtonDisabled = (plan: PricingPlan) => {
    return mode === 'billing' && currentPlanId === plan.id
  }

  return (
    <div className='space-y-4'>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
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
                <span>Самый популярный</span>
                )}
                {currentPlanId === tier.id && mode === 'billing' && (
                  <span>Текущий план</span>
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
            <div className='flex items-baseline justify-center'>
              <span className='text-4xl font-bold'>{tier.price}</span>
              <span className='text-muted-foreground text-sm'>{tier.frequency}</span>
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
            {mode === 'billing' ? (
              <Button
                className='w-full cursor-pointer'
                size='lg'
                variant={getButtonVariant(tier)}
                disabled={isButtonDisabled(tier) || loadingPlanId === tier.id}
                onClick={() => handlePayment(tier.id)}
                aria-label={`${getButtonText(tier)} - ${tier.name} plan`}
              >
                {loadingPlanId === tier.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  getButtonText(tier)
                )}
              </Button>
            ) : (
              <Button
                className='w-full cursor-pointer'
                size='lg'
                variant={getButtonVariant(tier)}
                disabled={isButtonDisabled(tier)}
                aria-label={`${getButtonText(tier)} - ${tier.name} plan`}
                asChild
              >
                <Link href="/sign-in">
                  {getButtonText(tier)}
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
      </div>
    </div>
  )
}
