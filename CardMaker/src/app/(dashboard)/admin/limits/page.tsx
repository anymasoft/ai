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
  total_generations: number
  used_generations: number
  remaining_generations: number
}

export default function AdminLimitsPage() {
  const [usages, setUsages] = useState<UserUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmail, setFilterEmail] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchUsages()
  }, [])

  async function fetchUsages() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      const mappedUsages = (data.users || []).map((user: any) => ({
        userId: user.id,
        email: user.email,
        total_generations: user.total_generations || 0,
        used_generations: user.used_generations || 0,
        remaining_generations: Math.max(0, (user.total_generations || 0) - (user.used_generations || 0)),
      }))
      setUsages(mappedUsages)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load package information")
    } finally {
      setLoading(false)
    }
  }

  // Фильтруем использование
  const filteredUsages = usages.filter((usage) => {
    const matchEmail = usage.email.toLowerCase().includes(filterEmail.toLowerCase())
    return matchEmail
  })

  // Пагинация
  const totalPages = Math.ceil(filteredUsages.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedUsages = filteredUsages.slice(startIndex, endIndex)

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
          <h1 className="text-3xl font-bold">Generation Packages</h1>
          <p className="text-muted-foreground">User generation package usage</p>
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
          <CardTitle>Package Usage</CardTitle>
          <CardDescription>
            {filteredUsages.length} of {usages.length} users
            {filteredUsages.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
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
          ) : filteredUsages.length === 0 ? (
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
                    <TableHead>Package</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsages.map((usage) => (
                    <TableRow key={usage.userId}>
                      <TableCell className="font-mono text-sm truncate overflow-hidden text-ellipsis break-all" title={usage.email}>{usage.email}</TableCell>
                      <TableCell className="font-semibold">{usage.total_generations}</TableCell>
                      <TableCell>{usage.used_generations}</TableCell>
                      <TableCell className="font-semibold">{usage.remaining_generations}</TableCell>
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
