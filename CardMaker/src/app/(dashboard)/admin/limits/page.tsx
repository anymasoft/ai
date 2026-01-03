"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"

interface UserBalance {
  userId: string
  email: string
  generation_balance: number
  generation_used: number
}

export default function AdminLimitsPage() {
  const [balances, setBalances] = useState<UserBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmail, setFilterEmail] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchBalances()
  }, [])

  async function fetchBalances() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/limits")
      if (!res.ok) throw new Error("Failed to fetch balances")
      const data = await res.json()
      setBalances(data.balances || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load balance information")
    } finally {
      setLoading(false)
    }
  }

  // Фильтруем балансы
  const filteredBalances = balances.filter((balance) => {
    const matchEmail = balance.email.toLowerCase().includes(filterEmail.toLowerCase())
    return matchEmail
  })

  // Пагинация
  const totalPages = Math.ceil(filteredBalances.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedBalances = filteredBalances.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEmail])

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return "bg-green-500"
    if (percentage < 80) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Баланс описаний</h1>
          <p className="text-muted-foreground">Просмотр баланса описаний пользователей</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchBalances}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance Overview</CardTitle>
          <CardDescription>
            {filteredBalances.length} of {balances.length} users
            {filteredBalances.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Email</label>
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
            <div className="flex-1 min-w-[120px]">
              <label className="text-sm font-medium">Per page</label>
              <Select value={String(pageSize)} onValueChange={(v) => {
                setPageSize(Number(v))
                setCurrentPage(1)
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Rows per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBalances.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users found
            </div>
          ) : (
            <>
            <div className="overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[240px]">Email</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBalances.map((balance) => (
                    <TableRow key={balance.userId}>
                      <TableCell className="font-mono text-sm truncate overflow-hidden text-ellipsis break-all" title={balance.email}>{balance.email}</TableCell>
                      <TableCell className="font-semibold">{balance.generation_balance}</TableCell>
                      <TableCell>{balance.generation_used}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredBalances.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredBalances.length)} of {filteredBalances.length} results
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
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
