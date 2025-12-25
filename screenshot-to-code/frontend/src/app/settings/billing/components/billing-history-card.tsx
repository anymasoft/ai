import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { fetchJSON } from "@/lib/api"

interface Payment {
  id: string
  user_id: string
  package: string
  credits_amount: number
  amount_rubles: number
  status: "pending" | "succeeded" | "canceled"
  created_at: string
}

interface BillingHistoryItem {
  id: number
  month: string
  plan: string
  amount: string
  status: string
}

interface BillingHistoryCardProps {
  history?: BillingHistoryItem[]
}

export function BillingHistoryCard({ history }: BillingHistoryCardProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    try {
      setLoading(true)
      console.log("[BILLING] Fetching user payments from /api/billing/user-payments")
      const data = await fetchJSON<{ payments: Payment[] }>("/api/billing/user-payments")
      console.log("[BILLING] Received response:", data)
      const paymentsList = data.payments || []
      console.log(`[BILLING] Got ${paymentsList.length} payments`)
      setPayments(paymentsList)
    } catch (error) {
      console.error("[BILLING] Error loading payments:", error)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPackageName = (pkg: string): string => {
    const names: Record<string, string> = {
      basic: "Basic",
      professional: "Professional",
    }
    return names[pkg] || pkg
  }

  const displayPayments = payments.length > 0 ? payments : history || []
  const visiblePayments = showAll ? displayPayments : displayPayments.slice(0, 2)
  const hasMorePayments = displayPayments.length > 2

  return (
    <Card>
      <CardHeader>
        <CardTitle>История платежей</CardTitle>
        <CardDescription>
          Просмотрите свои прошлые платежи и счета.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && payments.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayPayments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Платежи отсутствуют
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePayments.map((item: any, index) => (
              <div key={item.id}>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">
                      {item.month || formatDate(item.created_at)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.plan || getPackageName(item.package)} ({item.credits_amount} генераций)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {item.amount || `${item.amount_rubles.toFixed(0)} ₽`}
                    </div>
                    <Badge variant={item.status === "succeeded" ? "default" : "secondary"}>
                      {item.status === "succeeded" ? "✓ Оплачено" : item.status === "pending" ? "⏳ Ожидание" : "✗ Отменено"}
                    </Badge>
                  </div>
                </div>
                {index < visiblePayments.length - 1 && <Separator />}
              </div>
            ))}
            {hasMorePayments && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? "Скрыть" : `Показать ещё (${displayPayments.length - 2})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
