"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Package {
  key: string
  title: string
  price_rub: number
  generations: number
  is_active: number
}

const plans = [
  {
    name: 'Basic',
    description: 'Подходит продавцам с небольшим ассортиментом, которым важно быстро понять, есть ли риск отклонения карточки модерацией маркетплейса.',
    monthlyPrice: 990,
    features: [
      'Проверка описаний на соответствие правилам Ozon и Wildberries',
      'Выявление критических нарушений, из-за которых карточку могут отклонить',
      'Поиск запрещённых слов и формулировок',
      'Понимание общего статуса: пройдёт модерация или нет',
      'Возможность автоматически исправить найденные проблемы',
      'Подходит для первых проверок и нерегулярной работы'
    ],
    cta: 'Начать использовать',
    popular: false
  },
  {
    name: 'Professional',
    description: 'Подходит продавцам, которые постоянно добавляют или обновляют карточки и хотят быть уверены, что описания соответствуют требованиям маркетплейсов.',
    monthlyPrice: 2490,
    features: [
      'Удобно для регулярной проверки карточек перед публикацией',
      'Помогает заранее находить риски отклонения модерацией',
      'Экономит время на ручной проверке требований',
      'Один инструмент для работы с Ozon и Wildberries',
      'Подходит для активных продавцов с обновляемым ассортиментом'
    ],
    cta: 'Использовать регулярно',
    popular: true,
    includesPrevious: 'Всё, что входит в тариф Basic'
  },
  {
    name: 'Enterprise',
    description: 'Подходит продавцам и агентствам, работающим с большим количеством карточек, где важно системно контролировать соответствие требованиям маркетплейсов.',
    monthlyPrice: 5990,
    features: [
      'Удобно для работы с большими каталогами товаров',
      'Снижение риска массовых отклонений карточек',
      'Централизованный контроль качества описаний',
      'Подходит для командной и агентской работы',
      'Решение для масштабной и регулярной проверки'
    ],
    cta: 'Масштабировать работу',
    popular: false,
    includesPrevious: 'Всё, что входит в тариф Professional'
  }
]

export function PricingSection() {
  const [packages, setPackages] = useState<Package[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch('/api/packages')
        const data = await res.json()
        if (data.success && data.packages) {
          setPackages(data.packages)
        }
      } catch (error) {
        console.error('Error fetching packages:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPackages()
  }, [])

  // Функция для получения данных пакета по названию плана
  const getPackageData = (planName: string): Package | undefined => {
    return packages.find(pkg => pkg.title.toLowerCase() === planName.toLowerCase())
  }

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
            Выберите тариф, который подходит под объём вашей работы с карточками товаров — от разовых задач до регулярного использования.
          </p>
        </div>

        {/* Free Plan Info */}
        <div className="mx-auto max-w-6xl mb-12 p-8 rounded-xl border border-dashed bg-muted/30 text-center">
          <p className="text-lg font-medium tracking-tight text-foreground leading-relaxed mb-6">
            Free — чтобы попробовать сервис
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center justify-center gap-2">
              <span>•</span>
              <span>Проверьте описание товара на соответствие требованиям Ozon и Wildberries</span>
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
                    {(() => {
                      const pkg = getPackageData(plan.name)
                      return (
                        <>
                          <div className="text-4xl font-bold mb-1">
                            {pkg ? pkg.price_rub : plan.monthlyPrice} ₽
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {pkg ? `${pkg.generations} кредитов` : ''}
                          </div>
                        </>
                      )
                    })()}
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
                      asChild
                    >
                      <Link href="/sign-in">
                        {plan.cta}
                      </Link>
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
