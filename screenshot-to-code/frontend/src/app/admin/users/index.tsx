import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, RefreshCcw, MoreVertical } from "lucide-react"
import { toast } from "sonner"
import { fetchJSON, ApiError } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface User {
  id: string
  email: string
  name: string | null
  plan: string
  used_generations: number
  disabled: boolean
  role: string
  created_at: string
}

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [setUsageOpen, setSetUsageOpen] = useState(false)
  const [newPlan, setNewPlan] = useState<"free" | "basic" | "professional">("free")
  const [newUsage, setNewUsage] = useState(0)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)

      const data = await fetchJSON<{ users: User[] }>("/api/admin/users")

      setUsers(data.users || [])
    } catch (error) {
      console.error("Error:", error)
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Доступ запрещен")
        navigate("/playground")
      } else {
        toast.error("Ошибка при загрузке пользователей")
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU")
  }

  const getPlanBadge = (plan: string) => {
    if (!plan) return <Badge variant="secondary">free</Badge>
    return <Badge variant="outline">{plan}</Badge>
  }

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return <Badge variant="destructive">Admin</Badge>
    }
    return <Badge variant="secondary">User</Badge>
  }

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(emailFilter.toLowerCase())
  )

  // Action handlers
  async function handleDisableUser(user: User, disable: boolean) {
    if (!confirm(`${disable ? "Disable" : "Enable"} ${user.email}?`)) return

    setActionLoading(true)
    try {
      await fetchJSON("/api/admin/users/disable", {
        method: "PATCH",
        body: JSON.stringify({
          userId: user.id,
          disabled: disable,
        }),
      })
      toast.success(`User ${disable ? "disabled" : "enabled"}`)
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update user status")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangePlan() {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      await fetchJSON("/api/admin/users/change-plan", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUser.id,
          plan: newPlan,
        }),
      })
      toast.success(`Plan changed to ${newPlan}`)
      setChangePlanOpen(false)
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to change plan")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetLimits(user: User) {
    if (!confirm(`Reset limits for ${user.email}?`)) return

    setActionLoading(true)
    try {
      await fetchJSON(`/api/admin/users/${user.id}/reset-limits`, {
        method: "POST",
      })
      toast.success("Limits reset")
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to reset limits")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSetUsage() {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      await fetchJSON(`/api/admin/users/${selectedUser.id}/set-usage`, {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUser.id,
          used_generations: newUsage,
        }),
      })
      toast.success(`Usage set to ${newUsage}`)
      setSetUsageOpen(false)
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to set usage")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Пользователи</h1>
          <p className="text-muted-foreground">
            Всего: {filteredUsers.length}
          </p>
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
          <CardTitle>Список пользователей</CardTitle>
          <CardDescription>
            Управление пользователями платформы
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            <Input
              placeholder="Поиск по email..."
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Пользователей не найдено
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>План</TableHead>
                    <TableHead>Использовано</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead className="w-[50px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {getPlanBadge(user.plan)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.used_generations}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.disabled ? "destructive" : "outline"}>
                          {user.disabled ? "Disabled" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Действия</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {/* Disable/Enable */}
                            <DropdownMenuItem
                              onClick={() =>
                                handleDisableUser(user, !user.disabled)
                              }
                            >
                              {user.disabled ? "Enable" : "Disable"}
                            </DropdownMenuItem>

                            {/* Change Plan */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user)
                                setNewPlan(user.plan as any)
                                setChangePlanOpen(true)
                              }}
                            >
                              Change Plan
                            </DropdownMenuItem>

                            {/* Reset Limits */}
                            <DropdownMenuItem
                              onClick={() => handleResetLimits(user)}
                            >
                              Reset Limits
                            </DropdownMenuItem>

                            {/* Set Usage */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user)
                                setNewUsage(user.used_generations)
                                setSetUsageOpen(true)
                              }}
                            >
                              Set Usage
                            </DropdownMenuItem>
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

      {/* Change Plan Dialog */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Change {selectedUser?.email} plan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Plan</label>
              <Select value={newPlan} onValueChange={(value: any) => setNewPlan(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (30 generations)</SelectItem>
                  <SelectItem value="basic">Basic (200 generations)</SelectItem>
                  <SelectItem value="professional">Professional (1000 generations)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setChangePlanOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleChangePlan} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Usage Dialog */}
      <Dialog open={setUsageOpen} onOpenChange={setSetUsageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Usage</DialogTitle>
            <DialogDescription>
              Set generations used for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Used Generations</label>
              <Input
                type="number"
                min="0"
                value={newUsage}
                onChange={(e) => setNewUsage(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSetUsageOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetUsage} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Usage
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
