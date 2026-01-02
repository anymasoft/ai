"use client"

import { useState, useEffect } from "react"
import { useAdminUsers } from "@/hooks/useAdminUsers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Loader2, MoreHorizontal, RefreshCcw, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  name: string | null
  plan: string
  expiresAt: number | null
  createdAt: number
  disabled: boolean
  total_generations: number
  used_generations: number
}

const PAID_PLANS = ["basic", "professional", "enterprise"]

export default function AdminUsersPage() {
  const { users, loading, refresh } = useAdminUsers()
  const [selectedPlan, setSelectedPlan] = useState<string>("")
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [packageValue, setPackageValue] = useState<string>("")
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [disableAction, setDisableAction] = useState<"disable" | "enable">("disable")
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [filterEmail, setFilterEmail] = useState("")
  const [filterPlan, setFilterPlan] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  async function changePlan(userId: string, newPlan: string) {
    try {
      const res = await fetch("/api/admin/users/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: newPlan }),
      })
      if (!res.ok) throw new Error("Failed to update plan")
      toast.success("Plan updated")
      setShowPlanDialog(false)
      setSelectedPlan("")
      setSelectedUser("")
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update plan")
    }
  }

  async function toggleDisabled(userId: string, shouldDisable: boolean) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, disabled: shouldDisable }),
      })
      if (!res.ok) throw new Error("Failed to update user")
      toast.success(shouldDisable ? "User disabled" : "User enabled")
      setShowDisableDialog(false)
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update user")
    }
  }

  async function resetLimits(userId: string) {
    try {
      const res = await fetch("/api/admin/users/reset-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error("Failed to reset limits")
      toast.success("Limits reset")
      setShowResetDialog(false)
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to reset limits")
    }
  }

  async function manageLimits(userId: string) {
    try {
      if (!limitsKey) {
        toast.error("Limit key is required")
        return
      }

      const payload: any = { userId, key: limitsKey, action: limitsAction }

      if (limitsAction !== "reset") {
        const value = parseInt(limitsValue, 10)
        if (isNaN(value) || value < 0) {
          toast.error("Value must be a non-negative number")
          return
        }
        payload.value = value
      }

      const res = await fetch("/api/admin/users/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to manage limits")
      }

      const result = await res.json()
      toast.success(result.message || "Limit updated")
      setShowManageLimitsDialog(false)
      setLimitsKey("")
      setLimitsValue("")
      setLimitsAction("set")
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to manage limits")
    }
  }

  async function extendPayment(userId: string) {
    try {
      const res = await fetch("/api/admin/payments/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, days: 30 }),
      })
      if (!res.ok) throw new Error("Failed to extend")
      toast.success("Extended for 30 days")
      setShowExtendDialog(false)
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to extend")
    }
  }

  async function cancelPayment(userId: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          plan: "free",
        }),
      })
      if (!res.ok) throw new Error("Failed to cancel")
      toast.success("Payment cancelled")
      setShowCancelDialog(false)
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to cancel")
    }
  }

  async function savePackage(userId: string) {
    try {
      const value = parseInt(packageValue, 10)
      if (isNaN(value) || value < 0) {
        toast.error("Package value must be a non-negative number")
        return
      }

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, total_generations: value }),
      })
      if (!res.ok) throw new Error("Failed to save package")
      toast.success("Package updated")
      setPackageValue("")
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to save package")
    }
  }

  async function resetUsedGenerations(userId: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reset_used: true }),
      })
      if (!res.ok) throw new Error("Failed to reset")
      toast.success("Usage reset")
      refresh()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to reset usage")
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "—"
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      free: "bg-gray-100 text-gray-800",
      basic: "bg-blue-100 text-blue-800",
      professional: "bg-purple-100 text-purple-800",
      enterprise: "bg-amber-100 text-amber-800",
    }
    return colors[plan] || "bg-gray-100 text-gray-800"
  }

  // Фильтруем пользователей
  const filteredUsers = users.filter((user) => {
    const matchEmail = user.email.toLowerCase().includes(filterEmail.toLowerCase())
    const matchPlan = !filterPlan || filterPlan === "all" || user.plan === filterPlan
    const matchStatus = !filterStatus || filterStatus === "all" || (filterStatus === "active" ? !user.disabled : user.disabled)
    return matchEmail && matchPlan && matchStatus
  })

  // Пагинация
  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEmail, filterPlan, filterStatus])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage users and their plans</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users List</CardTitle>
          <CardDescription>
            {filteredUsers.length} of {users.length} users
            {filteredUsers.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input
                placeholder="Filter by email..."
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-muted-foreground">Plan</label>
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
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-sm font-medium text-muted-foreground">Per page</label>
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
            {(filterEmail || filterPlan || filterStatus) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterEmail("")
                  setFilterPlan("")
                  setFilterStatus("")
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users found
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users match the filters
            </div>
          ) : (
            <>
            <div className="overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[240px]">Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm truncate overflow-hidden text-ellipsis break-all" title={user.email}>{user.email}</TableCell>
                      <TableCell>{user.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={getPlanColor(user.plan)}>
                          {user.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <span>{user.used_generations}/{user.total_generations}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(user.expiresAt)}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={user.disabled ? "destructive" : "outline"}>
                          {user.disabled ? "Disabled" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Dialog open={showPlanDialog && selectedUser === user.id} onOpenChange={setShowPlanDialog}>
                              <DialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault()
                                    setSelectedUser(user.id)
                                    setShowPlanDialog(true)
                                  }}
                                >
                                  Change Plan
                                </DropdownMenuItem>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Change Plan</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="free">Free</SelectItem>
                                      <SelectItem value="basic">Basic</SelectItem>
                                      <SelectItem value="professional">Professional</SelectItem>
                                      <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => changePlan(user.id, selectedPlan)}
                                      disabled={!selectedPlan}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setShowPlanDialog(false)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog open={showExtendDialog && selectedUser === user.id} onOpenChange={setShowExtendDialog}>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setSelectedUser(user.id)
                                  setShowExtendDialog(true)
                                }}
                              >
                                Extend 30 Days
                              </DropdownMenuItem>
                              <AlertDialogContent>
                                <AlertDialogTitle>Extend Payment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Extend this subscription for 30 more days?
                                </AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => extendPayment(user.id)}
                                  >
                                    Extend
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog open={showCancelDialog && selectedUser === user.id} onOpenChange={setShowCancelDialog}>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setSelectedUser(user.id)
                                  setShowCancelDialog(true)
                                }}
                              >
                                Cancel Payment
                              </DropdownMenuItem>
                              <AlertDialogContent>
                                <AlertDialogTitle>Cancel Payment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cancel this subscription? The user will revert to free plan immediately.
                                </AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelPayment(user.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Cancel Payment
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog open={showDisableDialog && selectedUser === user.id} onOpenChange={setShowDisableDialog}>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setSelectedUser(user.id)
                                  setDisableAction(user.disabled ? "enable" : "disable")
                                  setShowDisableDialog(true)
                                }}
                              >
                                {user.disabled ? "Enable" : "Disable"}
                              </DropdownMenuItem>
                              <AlertDialogContent>
                                <AlertDialogTitle>
                                  {disableAction === "disable" ? "Отключить пользователя" : "Включить пользователя"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to {disableAction} this user? This action cannot be undone.
                                </AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => toggleDisabled(user.id, disableAction === "disable")}
                                  >
                                    {disableAction === "disable" ? "Disable" : "Enable"}
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog open={showResetDialog && selectedUser === user.id} onOpenChange={setShowResetDialog}>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setSelectedUser(user.id)
                                  setShowResetDialog(true)
                                }}
                              >
                                Reset Limits
                              </DropdownMenuItem>
                              <AlertDialogContent>
                                <AlertDialogTitle>Reset Limits</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Reset daily usage limits for this user? This will clear their daily usage counter.
                                </AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => resetLimits(user.id)}
                                  >
                                    Reset
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>

                            <Dialog open={showManageLimitsDialog && selectedUser === user.id} onOpenChange={setShowManageLimitsDialog}>
                              <DialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault()
                                    setSelectedUser(user.id)
                                    setPackageValue("")
                                  }}
                                >
                                  Set Package
                                </DropdownMenuItem>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader>
                                  <DialogTitle>Set Generation Package</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium">Package Size (generations)</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={packageValue}
                                      onChange={(e) => setPackageValue(e.target.value)}
                                      placeholder="Enter package size"
                                      className="mt-1"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => savePackage(user.id)}
                                      disabled={!packageValue}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setShowManageLimitsDialog(false)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                resetUsedGenerations(user.id)
                              }}
                            >
                              Reset Usage
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsers.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} results
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
