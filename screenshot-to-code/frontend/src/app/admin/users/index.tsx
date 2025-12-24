import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  plan_id: string | null
  role: string
  created_at: string
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:7001"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const adminEmail = localStorage.getItem("dev_admin_email") || "admin@screen2code.com"

      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: {
          "X-Admin-Email": adminEmail,
        },
      })

      if (!res.ok) throw new Error("Failed to fetch users")

      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при загрузке пользователей")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU")
  }

  const getPlanBadge = (planId: string | null) => {
    if (!planId) return <Badge variant="secondary">No Plan</Badge>
    return <Badge variant="outline">{planId}</Badge>
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
                    <TableHead>Роль</TableHead>
                    <TableHead>Создан</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {getPlanBadge(user.plan_id)}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
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
