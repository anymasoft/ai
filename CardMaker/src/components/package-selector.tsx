'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

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

export function PackageSelector({ onPackageSelect }: PackageSelectorProps) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      {packages.map((pkg) => (
        <Card key={pkg.key}>
          <CardHeader>
            <CardTitle>{pkg.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-3xl font-bold">
                {pkg.price_rub} ₽
              </div>
              <div className="text-sm text-muted-foreground">
                {pkg.generations} описаний
              </div>
            </div>

            <Button
              className="w-full"
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
      ))}
    </div>
  )
}
