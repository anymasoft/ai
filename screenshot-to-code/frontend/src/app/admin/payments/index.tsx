import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { fetchJSON, ApiError } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [refreshing, setRefreshing] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [emailFilter, setEmailFilter] = useState("")

  useEffect(() => {
    fetchPayments()
  }, [emailFilter])

  async function fetchPayments() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (emailFilter) {
        params.append("email", emailFilter)
      }
      const url = `/api/admin/payments${params.toString() ? "?" + params.toString() : ""}`
      const data = await fetchJSON<{ payments: Payment[] }>(url)
      setPayments(data.payments || [])
    } catch (error) {
      console.error("[ADMIN] Error loading payments:", error)
      toast.error("Ошибка при загрузке платежей")
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchPayments()
    setRefreshing(false)
    toast.success("Платежи обновлены")
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

  const getPlanName = (plan: string): string => {
    const names: Record<string, string> = {
      basic: "Basic",
      professional: "Professional",
    }
    return names[plan] || plan
  }

  // Пагинация
  const totalPages = Math.ceil(payments.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPayments = payments.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении размера страницы
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Платежи</h1>
            <p className="text-muted-foreground">Список всех платежей</p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="icon">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Email Filter */}
        <div className="flex gap-2">
          <Input
            placeholder="Фильтр по email..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="max-w-sm"
          />
          {emailFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmailFilter("")}
            >
              Очистить
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>История платежей ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Платежи отсутствуют</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>План</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Провайдер</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{getPlanName(p.plan)}</TableCell>
                      <TableCell>{(p.amount / 100).toFixed(2)} {p.currency}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {p.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(p.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {payments.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">Строк на странице:</label>
                      <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Предыдущая
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="min-w-[40px]"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Следующая
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
