'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface PaymentRecord {
  id: number
  plan: string
  amount: string
  provider: string
  status: string
  expiresAt: number | null
  createdAt: number
}

export function BillingHistoryCard() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/payments/user-history?limit=10")
      if (!res.ok) throw new Error("Failed to fetch payment history")
      const data = await res.json()
      setPayments(data.payments || [])
    } catch (err) {
      console.error("Error fetching payments:", err)
      setError("Не удалось загрузить историю платежей")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: "bg-gray-100 text-gray-800",
      basic: "bg-blue-100 text-blue-800",
      professional: "bg-purple-100 text-purple-800",
      enterprise: "bg-amber-100 text-amber-800",
    }
    return colors[plan] || "bg-gray-100 text-gray-800"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История платежей</CardTitle>
        <CardDescription>
          Просмотрите свои прошлые счёта и платежи.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">История платежей пока пуста</p>
            <p className="text-xs text-muted-foreground mt-1">
              История платежей появится после вашего первого платежа.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={getPlanBadge(payment.plan)}>
                      {payment.plan}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{payment.amount}</p>
                  <p className="text-xs text-muted-foreground">
                    {payment.status === "succeeded" ? "✓ Успешно" : payment.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
