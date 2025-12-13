"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"

interface UserLimit {
  userId: string
  email: string
  plan: string
  analysesPerDay: number
  scriptsPerDay: number
  cooldownHours: number
  analysesUsed?: number
  scriptsUsed?: number
}

export default function AdminLimitsPage() {
  const [limits, setLimits] = useState<UserLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<string>("")
  const [formData, setFormData] = useState({
    plan: "free",
    analysesPerDay: 0,
    scriptsPerDay: 0,
    cooldownHours: 0,
  })
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [filterEmail, setFilterEmail] = useState("")
  const [filterPlan, setFilterPlan] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchLimits()
  }, [])

  async function fetchLimits() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/limits")
      if (!res.ok) throw new Error("Failed to fetch limits")
      const data = await res.json()
      setLimits(data.limits || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load limits")
    } finally {
      setLoading(false)
    }
  }

  function openEditDialog(limit: UserLimit) {
    setEditingUser(limit.userId)
    setFormData({
      plan: limit.plan,
      analysesPerDay: limit.analysesPerDay,
      scriptsPerDay: limit.scriptsPerDay,
      cooldownHours: limit.cooldownHours,
    })
    setShowEditDialog(true)
  }

  async function saveLimits() {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser,
          plan: formData.plan,
        }),
      })
      
      // Также обновляем лимиты
      const res2 = await fetch("/api/admin/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser,
          analysesPerDay: formData.analysesPerDay,
          scriptsPerDay: formData.scriptsPerDay,
          cooldownHours: formData.cooldownHours,
        }),
      })
      if (!res.ok || !res2.ok) throw new Error("Failed to update limits")
      toast.success("Limits updated")
      setShowEditDialog(false)
      fetchLimits()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update limits")
    }
  }

  async function resetUsageToday(userId: string) {
    try {
      const res = await fetch("/api/admin/limits/reset-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error("Failed to reset usage")
      toast.success("Usage reset for today")
      setShowResetDialog(false)
      fetchLimits()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to reset usage")
    }
  }

  // Фильтруем лимиты
  const filteredLimits = limits.filter((limit) => {
    const matchEmail = limit.email.toLowerCase().includes(filterEmail.toLowerCase())
    const matchPlan = filterPlan === "all" || !filterPlan || limit.plan === filterPlan
    return matchEmail && matchPlan
  })

  // Пагинация
  const totalPages = Math.ceil(filteredLimits.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedLimits = filteredLimits.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEmail, filterPlan])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage Limits</h1>
          <p className="text-muted-foreground">Configure daily limits per user</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchLimits}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Limits</CardTitle>
          <CardDescription>
            {filteredLimits.length} of {limits.length} users
            {filteredLimits.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Фильтровать по электронной почте..."
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
                    <SelectValue placeholder="Все тарифы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
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
                    <SelectValue placeholder="Строк на странице" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 rows</SelectItem>
                    <SelectItem value="20">20 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLimits.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No limits configured
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Analyses/Day</TableHead>
                    <TableHead className="text-right">Scripts/Day</TableHead>
                    <TableHead className="text-right">Used Today</TableHead>
                    <TableHead className="text-right">Cooldown (h)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLimits.map((limit) => (
                    <TableRow key={limit.userId}>
                      <TableCell className="font-mono text-sm">{limit.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{limit.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{limit.analysesPerDay}</TableCell>
                      <TableCell className="text-right">{limit.scriptsPerDay}</TableCell>
                      <TableCell className="text-right">
                        {limit.analysesUsed || 0} / {limit.scriptsUsed || 0}
                      </TableCell>
                      <TableCell className="text-right">{limit.cooldownHours}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog open={showEditDialog && editingUser === limit.userId} onOpenChange={setShowEditDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(limit)}
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Limits - {limit.email}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="plan">Plan</Label>
                                  <Select value={formData.plan} onValueChange={(value) =>
                                    setFormData({ ...formData, plan: value })
                                  }>
                                    <SelectTrigger id="plan">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="free">Free</SelectItem>
                                      <SelectItem value="pro">Pro</SelectItem>
                                      <SelectItem value="business">Business</SelectItem>
                                      <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="analyses">Analyses per Day</Label>
                                  <Input
                                    id="analyses"
                                    type="number"
                                    value={formData.analysesPerDay}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        analysesPerDay: parseInt(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="scripts">Scripts per Day</Label>
                                  <Input
                                    id="scripts"
                                    type="number"
                                    value={formData.scriptsPerDay}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        scriptsPerDay: parseInt(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="cooldown">Cooldown Hours</Label>
                                  <Input
                                    id="cooldown"
                                    type="number"
                                    value={formData.cooldownHours}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        cooldownHours: parseInt(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={saveLimits}>Save</Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setShowEditDialog(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog open={showResetDialog && editingUser === limit.userId} onOpenChange={setShowResetDialog}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUser(limit.userId)
                                setShowResetDialog(true)
                              }}
                            >
                              Reset
                            </Button>
                            <AlertDialogContent>
                              <AlertDialogTitle>Reset Usage</AlertDialogTitle>
                              <AlertDialogDescription>
                                Reset daily usage counter for {limit.email}? This will clear today's usage.
                              </AlertDialogDescription>
                              <div className="flex gap-2 justify-end">
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => resetUsageToday(limit.userId)}
                                >
                                  Reset
                                </AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredLimits.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredLimits.length)} of {filteredLimits.length} results
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
