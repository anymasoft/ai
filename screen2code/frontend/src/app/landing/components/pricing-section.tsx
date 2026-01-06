
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useState, useEffect } from 'react'
import { getAppUrl } from '@/lib/utils'
import { fetchJSON } from '@/lib/api'

interface Tariff {
  key: string
  name: string
  price_rub: number
  credits: number
  is_active: boolean
}

const plans = [
  {
    name: 'Free',
    description: 'Perfect for getting started with essential components',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Access to 50+ free components',
      'Basic dashboard templates',
      'Community support',
      'GitHub repository access',
      'Documentation and guides'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    name: 'Pro',
    description: 'For developers who need premium templates and components',
    monthlyPrice: 19,
    yearlyPrice: 15,
    features: [
      'Premium template collection',
      'Advanced dashboard layouts',
      'Priority support',
      'Commercial use license',
      'Early access to new releases',
      'Figma design files',
      'Custom component requests',
      'Direct developer access',
      'Exclusive design resources'
    ],
    cta: 'Get Started',
    popular: true,
    includesPrevious: 'All Free features, plus'
  },
  {
    name: 'Lifetime',
    description: 'One-time payment for lifetime access to everything',
    monthlyPrice: 299,
    yearlyPrice: 299,
    features: [
      'Lifetime updates and support',
      'Private Discord channel',
      'No recurring fees ever',
      'Future template access',
      'VIP support priority',
      'Exclusive beta features'
    ],
    cta: 'Get Started',
    popular: false,
    includesPrevious: 'All Pro features, plus'
  }
]

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)
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
    } catch (error) {
      console.error("Error loading tariffs:", error)
      setTariffs([])
    } finally {
      setLoading(false)
    }
  }

  // Map tariffs to plan structure
  const displayPlans = tariffs.map(tariff => ({
    key: tariff.key,
    name: tariff.name,
    description: tariff.key === 'free'
      ? 'Чтобы понять подход и качество результата'
      : tariff.key === 'basic'
      ? 'Для небольших сайтов и MVP'
      : 'Для регулярной и коммерческой работы',
    monthlyPrice: tariff.price_rub,
    yearlyPrice: tariff.price_rub,
    credits: tariff.credits,
    price_rub: tariff.price_rub,
    features: tariff.key === 'free'
      ? [
          'Превращение скриншота в рабочий HTML',
          'Максимальное визуальное сходство с оригиналом',
          'Читаемая структура разметки',
          'Tailwind-классы вместо ручного CSS',
          'Живой предпросмотр в процессе создания',
          'Подходит для тестов и экспериментов',
          'Без подписок и обязательств'
        ]
      : tariff.key === 'basic'
      ? [
          'HTML / React / Vue — готовый код на выходе',
          'Быстрая сборка интерфейсов без ручной верстки',
          'Tailwind-классы, удобно дорабатывать вручную',
          'Экономия времени на типовых страницах',
          'Подходит для лендингов и внутренних сервисов',
          'Результат виден сразу, без ожидания финала',
          'Надёжная база для дальнейшей доработки'
        ]
      : [
          'Массовая операция с заготовками под проекты',
          'Быстрое клонирование существующих интерфейсов',
          'Экономия десятков часов ручной верстки',
          'Рабочий код, готовый к интеграции в проект',
          'Удобно для агентств и команд',
          'Подходит для коммерческих задач и клиентов',
          'Один инструмент вместо рутинной верстки'
        ],
    cta: tariff.key === 'free' ? 'Начать' : 'Купить пакет',
    popular: tariff.key === 'basic'
  }))

  const getPricePerOperation = (plan: any): number | null => {
    // Не показывать для free-пакета
    if (plan.key === 'free') return null

    // Если нет данных для расчёта - не показывать
    if (!plan.price_rub || !plan.credits || plan.credits === 0) return null

    // Рассчитать и округлить цену за операцию
    return Math.round(plan.price_rub / plan.credits)
  }

  if (loading) {
    return (
      <section id="pricing" className="py-24 sm:py-32 bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Загрузка тарифов...</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-12">
          <Badge variant="outline" className="mb-4">Тарифные планы</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Выберите объём под свои задачи
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            1 кредит = 1 создание сайта. Используйте ровно столько, сколько нужно.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-2 hidden">
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
                Месячно
              </ToggleGroupItem>
              <ToggleGroupItem
                value="yearly"
                className="data-[state=on]:bg-background data-[state=on]:border-border border-transparent border px-6 !rounded-full data-[state=on]:text-foreground hover:bg-transparent cursor-pointer transition-colors"
              >
                Ежегодно
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <p className="text-sm text-muted-foreground hidden">
            <span className="text-primary font-semibold">Save 20%</span> On Annual Billing
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border">
            <div className="grid lg:grid-cols-3">
              {displayPlans.map((plan, index) => (
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
                      {plan.name === 'Lifetime' ? (
                        `${plan.monthlyPrice} ₽`
                      ) : plan.name === 'Free' ? (
                        '0 ₽'
                      ) : (
                        `${isYearly ? plan.yearlyPrice : plan.monthlyPrice} ₽`
                      )}
                    </div>
                    <div className="text-center text-sm text-muted-foreground mb-4">
                      {plan.key === 'free'
                        ? 'Включено: 3 операции бесплатно для старта'
                        : `Включено: ${plan.credits} операций`
                      }
                    </div>
                    {getPricePerOperation(plan) !== null && (
                      <div className="text-center text-sm text-muted-foreground mb-4">
                        ≈ {getPricePerOperation(plan)} ₽ за операцию
                      </div>
                    )}
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
                      <a href={getAppUrl("/log-in")}>
                        {plan.cta}
                      </a>
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
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Наши контакты: <a href="mailto:support@beem.ink" className="text-primary underline hover:text-primary/80 transition-colors">support@beem.ink</a>
          </p>
        </div>
      </div>
    </section>
  )
}
