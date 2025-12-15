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

interface UserUsage {
  userId: string
  email: string
  plan: string
  monthlyLimit: number
  monthlyUsed: number
  monthlyRemaining: number
  percentageUsed: number
}

export default function AdminLimitsPage() {
  const [usages, setUsages] = useState<UserUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmail, setFilterEmail] = useState("")
  const [filterPlan, setFilterPlan] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchUsages()
  }, [])

  async function fetchUsages() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/limits")
      if (!res.ok) throw new Error("Failed to fetch usages")
      const data = await res.json()
      setUsages(data.usages || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load usage information")
    } finally {
      setLoading(false)
    }
  }

  // Фильтруем использование
  const filteredUsages = usages.filter((usage) => {
    const matchEmail = usage.email.toLowerCase().includes(filterEmail.toLowerCase())
    const matchPlan = filterPlan === "all" || !filterPlan || usage.plan === filterPlan
    return matchEmail && matchPlan
  })

  // Пагинация
  const totalPages = Math.ceil(filteredUsages.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedUsages = filteredUsages.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEmail, filterPlan])

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return "bg-green-500"
    if (percentage < 80) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Script Usage</h1>
          <p className="text-muted-foreground">Monitor monthly script generation limits</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchUsages}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Script Usage</CardTitle>
          <CardDescription>
            {filteredUsages.length} of {usages.length} users
            {filteredUsages.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
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
            <div>
              <label className="text-sm font-medium">Plan</label>
              <Select value={filterPlan || "all"} onValueChange={setFilterPlan}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
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
          ) : filteredUsages.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users found
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly Limit</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsages.map((usage) => (
                    <TableRow key={usage.userId}>
                      <TableCell className="font-mono text-sm">{usage.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{usage.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{usage.monthlyLimit} scripts</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-semibold">{usage.monthlyUsed}</span>
                          <span className="text-muted-foreground"> / {usage.monthlyLimit}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(usage.percentageUsed)}`}
                              style={{ width: `${Math.min(usage.percentageUsed, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-10 text-right">{usage.percentageUsed}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsages.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredUsages.length)} of {filteredUsages.length} results
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
