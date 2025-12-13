"use client"

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useState } from 'react'

const plans = [
  {
    name: 'Basic',
    description: 'Для начинающих авторов',
    monthlyPrice: 990,
    yearlyPrice: 9900,
    features: [
      'До 30 AI-сценариев в месяц',
      'Генерация сценариев по любым YouTube-видео',
      'Готовая структура сценария: захват внимания → развитие → финал',
      'История всех сгенерированных сценариев',
      'Подходит для личных каналов и первых запусков'
    ],
    cta: 'Сгенерировать сценарий',
    popular: false
  },
  {
    name: 'Professional',
    description: 'Для растущих каналов',
    monthlyPrice: 2490,
    yearlyPrice: 24900,
    features: [
      'До 100 AI-сценариев в месяц',
      'Подходит для регулярного выпуска контента',
      'Удобно тестировать идеи и форматы видео',
      'Один инструмент для всех сценариев канала'
    ],
    cta: 'Создавать сценарии регулярно',
    popular: true,
    includesPrevious: 'Все возможности Basic, плюс'
  },
  {
    name: 'Enterprise',
    description: 'Для студий и команд',
    monthlyPrice: 5990,
    yearlyPrice: 59900,
    features: [
      'До 300 AI-сценариев в месяц',
      'Подходит для агентств и продакшн-команд',
      'Коммерческое использование сценариев',
      'Большие объёмы контента в одном аккаунте'
    ],
    cta: 'Использовать в работе',
    popular: false,
    includesPrevious: 'Все возможности Professional, плюс'
  }
]

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-12">
          <Badge variant="outline" className="mb-4">Тарифные планы</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Выберите подходящий план
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Выберите тариф, который подходит для вашего канала. Начните с базовых функций или выберите профессиональный план для больших объёмов генерации сценариев.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-2">
            <ToggleGroup
              type="single"
              value={isYearly ? "yearly" : "monthly"}
              onValueChange={(value) => setIsYearly(value === "yearly")}
              className="bg-secondary text-secondary-foreground border-none rounded-full p-1 cursor-pointer shadow-none"
            >
              <ToggleGroupItem
                value="monthly"
                className="data-[state=on]:bg-background data-[state=on]:border-border border-transparent border px-6 !rounded-full data-[state=on]:text-foreground hover:bg-transparent cursor-pointer transition-colors"
              >
                Помесячно
              </ToggleGroupItem>
              <ToggleGroupItem
                value="yearly"
                className="data-[state=on]:bg-background data-[state=on]:border-border border-transparent border px-6 !rounded-full data-[state=on]:text-foreground hover:bg-transparent cursor-pointer transition-colors"
              >
                Годовой
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="text-primary font-semibold">Экономия</span> при годовой подписке
          </p>
        </div>

        {/* Free Plan Info */}
        <div className="mx-auto max-w-6xl mb-8 p-6 rounded-xl border border-dashed bg-muted/30">
          <div className="text-lg font-semibold mb-3">Бесплатный доступ</div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Free — для знакомства с сервисом
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5">•</span>
              <span>До 3 AI-сценариев в месяц</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5">•</span>
              <span>Генерация по YouTube-ссылке</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5">•</span>
              <span>Без обновления аналитики</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5">•</span>
              <span>Без повторной генерации</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5">•</span>
              <span>Подходит, чтобы попробовать сервис перед оплатой</span>
            </li>
          </ul>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border">
            <div className="grid lg:grid-cols-3">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`p-8 grid grid-rows-subgrid row-span-4 gap-6 ${
                    plan.popular
                      ? 'my-2 mx-4 rounded-xl bg-card border-transparent shadow-xl ring-1 ring-foreground/10 backdrop-blur'
                      : ''
                  }`}
                >
                  {/* Plan Header */}
                  <div>
                    <div className="text-lg font-medium tracking-tight mb-2">{plan.name}</div>
                    <div className="text-muted-foreground text-balance text-sm">{plan.description}</div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <div className="text-4xl font-bold mb-1">
                      {isYearly ? plan.yearlyPrice : plan.monthlyPrice} ₽
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {isYearly ? 'в год' : 'в месяц'}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div>
                    <Button
                      className={`w-full cursor-pointer my-2 ${
                        plan.popular
                          ? 'shadow-md border-[0.5px] border-white/25 shadow-black/20 bg-primary ring-1 ring-primary/15 text-primary-foreground hover:bg-primary/90'
                          : 'shadow-sm shadow-black/15 border border-transparent bg-background ring-1 ring-foreground/10 hover:bg-muted/50'
                      }`}
                      variant={plan.popular ? 'default' : 'secondary'}
                    >
                      {plan.cta}
                    </Button>
                  </div>

                  {/* Features */}
                  <div>
                    <ul role="list" className="space-y-3 text-sm">
                      {plan.includesPrevious && (
                        <li className="flex items-center gap-3 font-medium">
                          {plan.includesPrevious}:
                        </li>
                      )}
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-3">
                          <Check className="text-muted-foreground size-4 flex-shrink-0" strokeWidth={2.5} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enterprise Note */}
        {/* <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Need custom components or have questions? {' '}
            <Button variant="link" className="p-0 h-auto cursor-pointer" asChild>
              <a href="#contact">
                Contact our team
              </a>
            </Button>
          </p>
        </div> */}
      </div>
    </section>
  )
}
