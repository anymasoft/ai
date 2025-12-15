'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface PaymentRecord {
  id: number
  plan: string
  amount: string
  provider: string
  status: string
  expiresAt: number | null
  createdAt: number
}

const DISPLAY_COUNT = 2 // Показываем только 2 последних платежа в карточке

export function BillingHistoryCard() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllModal, setShowAllModal] = useState(false)
  const [modalPage, setModalPage] = useState(1)
  const [modalPageSize] = useState(20)

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    try {
      setLoading(true)
      setError(null)
      // Загружаем все платежи
      const res = await fetch("/api/payments/user-history?limit=100")
      if (!res.ok) throw new Error("Failed to fetch payment history")
      const data = await res.json()
      setAllPayments(data.payments || [])
      // Показываем только последние DISPLAY_COUNT платежей
      setPayments((data.payments || []).slice(0, DISPLAY_COUNT))
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

  // Пагинация для модального окна
  const totalPages = Math.ceil(allPayments.length / modalPageSize)
  const startIndex = (modalPage - 1) * modalPageSize
  const endIndex = startIndex + modalPageSize
  const paginatedPayments = allPayments.slice(startIndex, endIndex)

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

            {/* Кнопка для открытия полной истории */}
            {allPayments.length > DISPLAY_COUNT && (
              <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full mt-2">
                    Показать все платежи ({allPayments.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>История всех платежей</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    {paginatedPayments.map((payment) => (
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

                  {/* Пагинация модального окна */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t pt-4 mt-4">
                      <div className="text-sm text-muted-foreground">
                        Страница {modalPage} из {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModalPage(p => Math.max(1, p - 1))}
                          disabled={modalPage === 1}
                        >
                          Назад
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={modalPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setModalPage(page)}
                              className="min-w-[40px]"
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                          disabled={modalPage === totalPages}
                        >
                          Далее
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
