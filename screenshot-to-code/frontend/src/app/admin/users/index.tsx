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
interface User {
  id: string
  email: string
  name: string | null
  plan: string
  credits: number
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
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false)
  const [disableConfirmAction, setDisableConfirmAction] = useState<{user: User, disable: boolean} | null>(null)
  const [addCreditsOpen, setAddCreditsOpen] = useState(false)
  const [addCreditsAmount, setAddCreditsAmount] = useState("")
  const [setCreditsOpen, setSetCreditsOpen] = useState(false)
  const [setCreditsAmount, setSetCreditsAmount] = useState("")

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
  function openDisableConfirm(user: User, disable: boolean) {
    setDisableConfirmAction({ user, disable })
    setDisableConfirmOpen(true)
  }

  async function confirmDisableUser() {
    if (!disableConfirmAction) return

    setActionLoading(true)
    try {
      await fetchJSON("/api/admin/users/disable", {
        method: "PATCH",
        body: JSON.stringify({
          userId: disableConfirmAction.user.id,
          disabled: disableConfirmAction.disable,
        }),
      })
      toast.success(`User ${disableConfirmAction.disable ? "disabled" : "enabled"}`)
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update user status")
    } finally {
      setActionLoading(false)
      setDisableConfirmOpen(false)
      setDisableConfirmAction(null)
    }
  }

  async function handleAddCredits() {
    if (!selectedUser || !addCreditsAmount) return

    const amount = parseInt(addCreditsAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Введите положительное число")
      return
    }

    setActionLoading(true)
    try {
      const response = await fetchJSON<{success: boolean, new_balance: number}>("/api/admin/users/add-credits", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: amount,
        }),
      })
      toast.success(`Добавлено ${amount} кредитов`)
      setAddCreditsOpen(false)
      setAddCreditsAmount("")
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при добавлении кредитов")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSetCredits() {
    if (!selectedUser || !setCreditsAmount) return

    const amount = parseInt(setCreditsAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error("Введите неотрицательное число")
      return
    }

    setActionLoading(true)
    try {
      const response = await fetchJSON<{success: boolean, new_balance: number}>("/api/admin/users/set-credits", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUser.id,
          credits: amount,
        }),
      })
      toast.success(`Баланс установлен на ${amount} кредитов`)
      setSetCreditsOpen(false)
      setSetCreditsAmount("")
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при установке баланса")
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
                    <TableHead>Баланс</TableHead>
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
                      <TableCell className="text-sm">
                        {user.credits}
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

                            {/* Отключить/Включить */}
                            <DropdownMenuItem
                              onClick={() =>
                                openDisableConfirm(user, !user.disabled)
                              }
                            >
                              {user.disabled ? "Enable" : "Disable"}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Добавить кредиты */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user)
                                setAddCreditsAmount("")
                                setAddCreditsOpen(true)
                              }}
                            >
                              Add credits
                            </DropdownMenuItem>

                            {/* Установить баланс */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user)
                                setSetCreditsAmount(user.credits.toString())
                                setSetCreditsOpen(true)
                              }}
                            >
                              Set credits
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

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить кредиты</DialogTitle>
            <DialogDescription>
              Добавить кредиты пользователю {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Количество кредитов</label>
              <Input
                type="number"
                min="1"
                value={addCreditsAmount}
                onChange={(e) => setAddCreditsAmount(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddCreditsOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddCredits} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Добавить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Credits Dialog */}
      <Dialog open={setCreditsOpen} onOpenChange={setSetCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Установить баланс</DialogTitle>
            <DialogDescription>
              Установить баланс кредитов для пользователя {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Новый баланс</label>
              <Input
                type="number"
                min="0"
                value={setCreditsAmount}
                onChange={(e) => setSetCreditsAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSetCreditsOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSetCredits} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Установить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable/Enable Confirmation Dialog */}
      <Dialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {disableConfirmAction?.disable ? "Disable User" : "Enable User"}
            </DialogTitle>
            <DialogDescription>
              {disableConfirmAction?.disable
                ? `Are you sure you want to disable ${disableConfirmAction?.user?.email}?`
                : `Are you sure you want to enable ${disableConfirmAction?.user?.email}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDisableConfirmOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={disableConfirmAction?.disable ? "destructive" : "default"}
              onClick={confirmDisableUser}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {disableConfirmAction?.disable ? "Disable" : "Enable"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
