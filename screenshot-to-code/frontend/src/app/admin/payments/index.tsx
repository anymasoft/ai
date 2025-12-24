import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"
import { fetchJSON, ApiError } from "@/lib/api"
import { useNavigate } from "react-router-dom"

interface Payment {
  id: string
  user_id: string
  email: string
  plan: string
  amount: number
  currency: string
  provider: string
  created_at: string
}

export default function AdminPaymentsPage() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSum, setTotalSum] = useState(0)
  const [emailFilter, setEmailFilter] = useState("")
  const [searchEmail, setSearchEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchPayments()
  }, [emailFilter])

  async function fetchPayments() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (emailFilter) {
        params.set("email", emailFilter)
      }

      const adminEmail = localStorage.getItem("dev_admin_email") || "admin@screen2code.com"

      const data = await fetchJSON<{ payments: Payment[]; totalSum: number; message?: string; error?: string }>(
        `/api/admin/payments?${params.toString()}`,
        {
          headers: {
            "X-Admin-Email": adminEmail,
          },
        }
      )

      setPayments(data.payments || [])
      setTotalSum(data.totalSum || 0)

      if (data.message || data.error) {
        setMessage(data.message || data.error)
      } else {
        setMessage(null)
      }
    } catch (error) {
      console.error("Error:", error)
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Доступ запрещен")
        navigate("/playground")
      } else {
        toast.error("Ошибка при загрузке платежей")
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    setEmailFilter(searchEmail)
  }

  function handleClearFilter() {
    setEmailFilter("")
    setSearchEmail("")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toLocaleString("ru-RU")} ${currency}`
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Платежи</h1>
          <p className="text-muted-foreground">
            История всех платежей
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchPayments}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Транзакции</CardTitle>
              <CardDescription>
                {payments.length} платежей найдено
              </CardDescription>
            </div>
            {totalSum > 0 && (
              <div className="text-lg font-semibold">
                Всего: {totalSum.toLocaleString("ru-RU")} ₽
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            <Input
              placeholder="Поиск по email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch()
              }}
              className="max-w-sm"
            />
            <Button onClick={handleSearch} variant="default" size="sm">
              Поиск
            </Button>
            {emailFilter && (
              <Button
                onClick={handleClearFilter}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {message && (
            <div className="bg-muted/50 border border-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {message ? null : "Платежей не найдено"}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>План</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Провайдер</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {payment.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.plan}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(payment.amount, payment.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{payment.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
