'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Check } from 'lucide-react'

interface Package {
  key: string
  title: string
  price_rub: number
  generations: number
  is_active: number
}

interface PackageSelectorProps {
  onPackageSelect?: (packageKey: string) => void
}

// Описания и фичи для каждого пакета
const PACKAGE_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  'basic': {
    description: 'Подходит продавцам с небольшим ассортиментом, которым важно быстро понять, есть ли риск отклонения карточки модерацией маркетплейса.',
    features: [
      'Проверка описаний на соответствие правилам Ozon и Wildberries',
      'Выявление критических нарушений, из-за которых карточку могут отклонить',
      'Поиск запрещённых слов и формулировок',
      'Понимание общего статуса: пройдёт модерация или нет',
      'Возможность автоматически исправить найденные проблемы',
      'Подходит для первых проверок и нерегулярной работы'
    ]
  },
  'professional': {
    description: 'Подходит продавцам, которые постоянно добавляют или обновляют карточки и хотят быть уверены, что описания соответствуют требованиям маркетплейсов.',
    features: [
      'Всё, что входит в тариф Basic',
      'Удобно для регулярной проверки карточек перед публикацией',
      'Помогает заранее находить риски отклонения модерацией',
      'Экономит время на ручной проверке требований',
      'Один инструмент для работы с Ozon и Wildberries',
      'Подходит для активных продавцов с обновляемым ассортиментом'
    ]
  },
  'enterprise': {
    description: 'Подходит продавцам и агентствам, работающим с большим количеством карточек, где важно системно контролировать соответствие требованиям маркетплейсов.',
    features: [
      'Всё, что входит в тариф Professional',
      'Удобно для работы с большими каталогами товаров',
      'Снижение риска массовых отклонений карточек',
      'Централизованный контроль качества описаний',
      'Подходит для командной и агентской работы',
      'Решение для масштабной и регулярной проверки'
    ]
  }
}

export function PackageSelector({ onPackageSelect }: PackageSelectorProps) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getPackageInfo = (title: string) => {
    const key = title.toLowerCase()
    return PACKAGE_DESCRIPTIONS[key] || { description: '', features: [] }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  async function fetchPackages() {
    try {
      setError(null)
      const res = await fetch('/api/packages')
      const data = await res.json()

      if (data.success) {
        setPackages(data.packages || [])
      } else {
        setError('Ошибка загрузки пакетов')
      }
    } catch (err) {
      console.error('Error fetching packages:', err)
      setError('Ошибка загрузки пакетов')
    } finally {
      setLoading(false)
    }
  }

  async function handlePayment(packageKey: string) {
    try {
      setError(null)
      setLoadingPackage(packageKey)

      const response = await fetch('/api/payments/yookassa/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageKey,
        }),
      })

      const data = await response.json()

      if (!data.success || !data.paymentUrl) {
        setError(data.error || 'Ошибка создания платежа')
        return
      }

      // Redirect to payment
      window.location.href = data.paymentUrl
    } catch (err) {
      console.error('Payment error:', err)
      setError('Ошибка системы платежей')
    } finally {
      setLoadingPackage(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {packages.map((pkg) => {
        const info = getPackageInfo(pkg.title)
        return (
          <Card key={pkg.key} className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-lg">{pkg.title}</CardTitle>
              <CardDescription className="text-sm">
                {info.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div>
                <div className="text-4xl font-bold">
                  {pkg.price_rub} ₽
                </div>
                <div className="text-sm text-muted-foreground">
                  {pkg.generations} кредитов
                </div>
              </div>

              <div className="space-y-3">
                {info.features.map((feature, idx) => (
                  <div key={idx} className="flex gap-3">
                    <Check className="text-muted-foreground size-4 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full mt-auto"
                onClick={() => handlePayment(pkg.key)}
                disabled={loadingPackage === pkg.key}
              >
                {loadingPackage === pkg.key ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  'Купить'
                )}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
