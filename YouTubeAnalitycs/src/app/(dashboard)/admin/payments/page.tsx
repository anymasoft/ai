"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Loader2, MoreHorizontal, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"

interface Payment {
  userId: string
  email: string
  plan: string
  disabled: boolean
  isPaid: boolean
  expiresAt: number | null
  provider: string
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [formData, setFormData] = useState({
    plan: "professional",
    expiresAt: "",
  })
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [filterEmail, setFilterEmail] = useState("")
  const [filterPlan, setFilterPlan] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/payments")
      if (!res.ok) throw new Error("Failed to fetch payments")
      const data = await res.json()
      setPayments(data.payments || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load payments")
    } finally {
      setLoading(false)
    }
  }

  function openMarkPaidDialog(payment: Payment) {
    setSelectedUser(payment.userId)
    setFormData({
      plan: payment.plan,
      expiresAt: payment.expiresAt
        ? new Date(payment.expiresAt).toISOString().split("T")[0]
        : "",
    })
    setShowMarkPaidDialog(true)
  }

  async function markPaid() {
    if (!formData.expiresAt) {
      toast.error("Please select expiration date")
      return
    }

    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          plan: formData.plan,
          isPaid: true,
          expiresAt: new Date(formData.expiresAt).getTime(),
          provider: "manual",
        }),
      })
      if (!res.ok) throw new Error("Failed to mark paid")
      toast.success("Marked as paid")
      setShowMarkPaidDialog(false)
      fetchPayments()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to mark as paid")
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
      fetchPayments()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to extend")
    }
  }

  async function cancelPayment(userId: string) {
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isPaid: false,
          expiresAt: new Date().getTime(),
        }),
      })
      if (!res.ok) throw new Error("Failed to cancel")
      toast.success("Payment cancelled")
      setShowCancelDialog(false)
      fetchPayments()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to cancel")
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "—"
    return new Date(timestamp).toLocaleDateString()
  }

  // Фильтруем платежи
  const filteredPayments = payments.filter((payment) => {
    const matchEmail = payment.email.toLowerCase().includes(filterEmail.toLowerCase())
    const matchPlan = filterPlan === "all" || !filterPlan || payment.plan === filterPlan
    const matchStatus =
      filterStatus === "all" ||
      !filterStatus ||
      (filterStatus === "active" ? (payment.isPaid && !payment.disabled) :
       filterStatus === "pending" ? (!payment.isPaid && !payment.disabled) :
       filterStatus === "disabled" ? payment.disabled : true)
    return matchEmail && matchPlan && matchStatus
  })

  // Пагинация
  const totalPages = Math.ceil(filteredPayments.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  // Сброс на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEmail, filterPlan, filterStatus])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Manage subscriptions and payment status</p>
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
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            {filteredPayments.length} of {payments.length} payments
            {filteredPayments.length > 0 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment) => (
                    <TableRow key={payment.userId}>
                      <TableCell className="font-mono text-sm">{payment.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={payment.isPaid ? "default" : "secondary"}>
                          {payment.disabled ? "Disabled" : payment.isPaid ? "Active" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(payment.expiresAt)}</TableCell>
                      <TableCell className="text-sm">{payment.provider}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Dialog open={showMarkPaidDialog && selectedUser === payment.userId} onOpenChange={setShowMarkPaidDialog}>
                              <DialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault()
                                    openMarkPaidDialog(payment)
                                  }}
                                >
                                  Mark as Paid
                                </DropdownMenuItem>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Mark as Paid</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="plan">Plan</Label>
                                    <Select value={formData.plan} onValueChange={(value) =>
                                      setFormData({ ...formData, plan: value })
                                    }>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="basic">Basic</SelectItem>
                                        <SelectItem value="professional">Professional</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="expires">Expires At</Label>
                                    <Input
                                      id="expires"
                                      type="date"
                                      value={formData.expiresAt}
                                      onChange={(e) =>
                                        setFormData({ ...formData, expiresAt: e.target.value })
                                      }
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button onClick={markPaid}>Save</Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setShowMarkPaidDialog(false)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog open={showExtendDialog && selectedUser === payment.userId} onOpenChange={setShowExtendDialog}>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setSelectedUser(payment.userId)
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
                                    onClick={() => extendPayment(payment.userId)}
                                  >
                                    Extend
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog open={showCancelDialog && selectedUser === payment.userId} onOpenChange={setShowCancelDialog}>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setSelectedUser(payment.userId)
                                  setShowCancelDialog(true)
                                }}
                              >
                                Cancel
                              </DropdownMenuItem>
                              <AlertDialogContent>
                                <AlertDialogTitle>Cancel Payment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cancel this subscription? The user will revert to free plan immediately.
                                </AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelPayment(payment.userId)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Cancel Payment
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredPayments.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} results
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
