"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  name: string | null
  createdAt: number
  disabled: boolean
  generation_balance: number
  generation_used: number
}

interface UserValues {
  [userId: string]: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [values, setValues] = useState<UserValues>({})
  const [filterEmail, setFilterEmail] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      const usersList = data.users || []
      setUsers(usersList)

      // Инициализируем значения для каждого пользователя
      const newValues: UserValues = {}
      usersList.forEach((user: User) => {
        newValues[user.id] = user.generation_balance
      })
      setValues(newValues)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  async function saveUserBalance(userId: string) {
    try {
      setSaving(userId)
      const balance = values[userId]
      if (balance === undefined) return

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          generation_balance: balance,
        }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success("Balance updated")
      await fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update")
    } finally {
      setSaving(null)
    }
  }


  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(filterEmail.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user generation balance</p>
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
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} users
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-muted-foreground">Filter by email</label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Search email..."
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={values[user.id] || 0}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [user.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-20 border border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => saveUserBalance(user.id)}
                        disabled={saving === user.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {saving === user.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No users found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}