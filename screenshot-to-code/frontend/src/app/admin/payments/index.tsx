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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
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
  package: string
  credits_amount: number
  amount_rubles: number
  status: "pending" | "succeeded" | "canceled"
  created_at: string
}

export default function AdminPaymentsPage() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddCredits, setShowAddCredits] = useState(false)
  const [addingCredits, setAddingCredits] = useState(false)
  const [addUserId, setAddUserId] = useState("")
  const [addCreditsAmount, setAddCreditsAmount] = useState("")
  const [addReason, setAddReason] = useState("support")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    try {
      setLoading(true)
      const data = await fetchJSON<{ payments: Payment[]; total: number }>(
        "/api/billing/payments"
      )
      setPayments(data.payments || [])
    } catch (error) {
      console.error("[ADMIN] Error loading payments:", error)
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

  async function handleRefresh() {
    setRefreshing(true)
    await fetchPayments()
    setRefreshing(false)
    toast.success("Платежи обновлены")
  }

  async function handleAddCredits() {
    if (!addUserId.trim()) {
      toast.error("Укажите ID пользователя")
      return
    }
    const credits = parseInt(addCreditsAmount)
    if (isNaN(credits) || credits <= 0) {
      toast.error("Укажите положительное количество кредитов")
      return
    }
    try {
      setAddingCredits(true)
      await fetchJSON("/api/billing/add-credits", {
        method: "POST",
        body: JSON.stringify({
          user_id: addUserId,
          credits: credits,
          reason: addReason,
        }),
      })
      toast.success(`Добавлено ${credits} кредитов`)
      setAddUserId("")
      setAddCreditsAmount("")
      setAddReason("support")
      setShowAddCredits(false)
    } catch (error) {
      console.error("[ADMIN] Error adding credits:", error)
      toast.error("Ошибка при добавлении кредитов")
    } finally {
      setAddingCredits(false)
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Платежи</h1>
          <p className="text-muted-foreground">Список всех платежей</p>
        </div>
        <div className="space-x-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button onClick={() => setShowAddCredits(true)} className="bg-blue-600">
            + Добавить кредиты
          </Button>
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
                    <TableHead>Пакет</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.user_id.slice(0, 8)}</TableCell>
                      <TableCell>{getPackageName(p.package)}</TableCell>
                      <TableCell>{p.amount_rubles.toFixed(0)} ₽</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "succeeded" ? "default" : "secondary"}>
                          {p.status === "succeeded" ? "✓ Оплачено" : p.status === "pending" ? "⏳ Ожидание" : "✗ Отменено"}
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

      <Dialog open={showAddCredits} onOpenChange={setShowAddCredits}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить кредиты вручную</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              placeholder="ID пользователя"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              disabled={addingCredits}
              className="w-full px-3 py-2 border rounded"
            />
            <input
              placeholder="Количество кредитов"
              type="number"
              min="1"
              value={addCreditsAmount}
              onChange={(e) => setAddCreditsAmount(e.target.value)}
              disabled={addingCredits}
              className="w-full px-3 py-2 border rounded"
            />
            <select
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              disabled={addingCredits}
              className="w-full px-3 py-2 border rounded"
            >
              <option>Поддержка</option>
              <option>Компенсация</option>
              <option>Промо</option>
            </select>
            <div className="flex gap-3">
              <Button onClick={handleAddCredits} disabled={addingCredits} className="flex-1">
                {addingCredits && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Добавить
              </Button>
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">Отмена</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
