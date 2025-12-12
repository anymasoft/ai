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
import { Loader2, MoreHorizontal, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

interface Payment {
  userId: string
  email: string
  plan: string
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
    const matchStatus = filterStatus === "all" || !filterStatus || (filterStatus === "paid" ? payment.isPaid : !payment.isPaid)
    return matchEmail && matchPlan && matchStatus
  })

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
            Manage user subscriptions and payment status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
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
                <Select value={filterPlan} onValueChange={setFilterPlan}>
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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="paid">Active</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
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
                  {payments.map((payment) => (
                    <TableRow key={payment.userId}>
                      <TableCell className="font-mono text-sm">{payment.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={payment.isPaid ? "default" : "secondary"}>
                          {payment.isPaid ? "Paid" : "Free"}
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
