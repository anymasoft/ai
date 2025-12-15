"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCcw, X, Calendar as CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface Payment {
  id: number
  userId: string
  email: string
  plan: string
  expiresAt: number | null
  provider: string
  price: string
  createdAt: number
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmail, setFilterEmail] = useState("")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")
  const [selectedFromDate, setSelectedFromDate] = useState<Date | undefined>()
  const [selectedToDate, setSelectedToDate] = useState<Date | undefined>()
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalSum, setTotalSum] = useState(0)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    fetchPayments()
  }, [filterEmail, filterFrom, filterTo])

  async function fetchPayments() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterEmail) params.append("email", filterEmail)
      if (filterFrom) params.append("from", filterFrom)
      if (filterTo) params.append("to", filterTo)

      const res = await fetch(`/api/admin/payments?${params}`)
      if (!res.ok) throw new Error("Failed to fetch payments")
      const data = await res.json()
      setPayments(data.payments || [])
      setTotalSum(data.totalSum || 0)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load payments")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "—"
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return "Выберите дату"
    return date.toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" })
  }

  const handleFromDateSelect = (date: Date | undefined) => {
    setSelectedFromDate(date)
    if (date) {
      // Используем локальное форматирование вместо toISOString() чтобы избежать проблем с таймзоной
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      setFilterFrom(`${year}-${month}-${day}`)
    } else {
      setFilterFrom("")
    }
  }

  const handleToDateSelect = (date: Date | undefined) => {
    setSelectedToDate(date)
    if (date) {
      // Используем локальное форматирование вместо toISOString() чтобы избежать проблем с таймзоной
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      setFilterTo(`${year}-${month}-${day}`)
    } else {
      setFilterTo("")
    }
  }

  const formatPrice = (price: string) => {
    return price.replace(/\s/g, " ")
  }

  async function deletePayment(paymentId: number) {
    try {
      setDeletingId(paymentId)
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) throw new Error("Failed to delete payment")
      toast.success("Payment deleted")
      fetchPayments()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to delete payment")
    } finally {
      setDeletingId(null)
    }
  }

  // Фильтруем платежи по датам (если нужно дополнительная фильтрация на фронте)
  const filteredPayments = payments.filter((payment) => {
    const matchEmail = payment.email.toLowerCase().includes(filterEmail.toLowerCase())
    return matchEmail
  })

  // Пагинация
  const totalPages = Math.ceil(filteredPayments.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении фильтров или размера страницы
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEmail, filterFrom, filterTo, pageSize])

  // Сброс на первую страницу при изменении размера страницы
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">YooKassa Payments</h1>
          <p className="text-muted-foreground">Real payments from YooKassa gateway</p>
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
              <CardTitle>Payment Transactions</CardTitle>
              <CardDescription>
                {filteredPayments.length} payments found
                {filteredPayments.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
              </CardDescription>
            </div>
            {filteredPayments.length > 0 && (
              <div className="text-lg font-semibold">
                Total: {totalSum.toLocaleString("ru-RU")} ₽
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Filter by email..."
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                />
                {filterEmail && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterEmail("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-muted-foreground">От</label>
              <div className="flex gap-2 mt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal text-xs"
                    >
                      <CalendarIcon className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{formatDisplayDate(selectedFromDate)}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedFromDate}
                      onSelect={handleFromDateSelect}
                      disabled={(date) =>
                        selectedToDate ? date > selectedToDate : false
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {selectedFromDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleFromDateSelect(undefined)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-muted-foreground">До</label>
              <div className="flex gap-2 mt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal text-xs"
                    >
                      <CalendarIcon className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{formatDisplayDate(selectedToDate)}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedToDate}
                      onSelect={handleToDateSelect}
                      disabled={(date) =>
                        selectedFromDate ? date < selectedFromDate : false
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {selectedToDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToDateSelect(undefined)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No payments found
            </div>
          ) : (
            <>
            <div className="overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[240px]">Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm truncate overflow-hidden text-ellipsis break-all" title={payment.email}>{payment.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.plan}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatPrice(payment.price)}</TableCell>
                      <TableCell>{formatDate(payment.expiresAt)}</TableCell>
                      <TableCell>{formatDate(payment.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePayment(payment.id)}
                          disabled={deletingId === payment.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredPayments.length > 0 && (
              <>
              <div className="border-t pt-4 mt-4">
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Records per page:</label>
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
                    Previous
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
                    Next
                  </Button>
                </div>
              </div>
              </>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
