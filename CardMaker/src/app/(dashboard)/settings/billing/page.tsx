'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PackageSelector } from "@/components/package-selector"
import { BillingHistoryCard } from "./components/billing-history-card"
import { useCheckPaymentStatus } from "@/hooks/useCheckPaymentStatus"

export default function BillingSettings() {
  useCheckPaymentStatus()

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold">Описания</h1>
        <p className="text-muted-foreground">
          Купите пакеты для создания описаний товаров.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <BillingHistoryCard />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Доступные пакеты описаний</CardTitle>
            <CardDescription>
              Выберите пакет и пополните свой баланс.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PackageSelector />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
