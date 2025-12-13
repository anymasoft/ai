"use client"

import { useState, useEffect } from "react"
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
  createdAt: number
  lastActive: number | null
  disabled: boolean
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string>("")
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [disableAction, setDisableAction] = useState<"disable" | "enable">("disable")
  const [filterEmail, setFilterEmail] = useState("")
  const [filterPlan, setFilterPlan] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  async function changePlan(userId: string, newPlan: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: newPlan }),
      })
      if (!res.ok) throw new Error("Failed to update plan")
      toast.success("Plan updated")
      setShowPlanDialog(false)
      setSelectedPlan("")
      setSelectedUser("")
      fetchUsers()
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
      fetchUsers()
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
      fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to reset limits")
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
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
    const matchPlan = filterPlan === "all" || !filterPlan || user.plan === filterPlan
    const matchStatus = filterStatus === "all" || !filterStatus || (filterStatus === "active" ? !user.disabled : user.disabled)
    return matchEmail && matchPlan && matchStatus
  })

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
          onClick={fetchUsers}
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
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>{user.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={getPlanColor(user.plan)}>
                          {user.plan}
                        </Badge>
                      </TableCell>
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
                            <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
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

                            <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
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
                                  {disableAction === "disable" ? "Disable User" : "Enable User"}
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

                            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
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
