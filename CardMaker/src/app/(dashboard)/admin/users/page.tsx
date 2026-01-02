"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCcw, Check, X } from "lucide-react"
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBalance, setEditBalance] = useState<number>(0)
  const [savingId, setSavingId] = useState<string | null>(null)
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
      setUsers(data.users || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  async function saveBalance(userId: string, newBalance: number) {
    try {
      setSavingId(userId)
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, generation_balance: newBalance }),
      })
      if (!res.ok) throw new Error("Failed to update balance")
      toast.success("Balance updated")
      setEditingId(null)
      fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update balance")
    } finally {
      setSavingId(null)
    }
  }

  async function resetUsed(userId: string) {
    try {
      setSavingId(userId)
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reset_used: true }),
      })
      if (!res.ok) throw new Error("Failed to reset used")
      toast.success("Usage reset")
      fetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to reset used")
    } finally {
      setSavingId(null)
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
                  <TableHead>Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={editBalance}
                            onChange={(e) => setEditBalance(parseInt(e.target.value) || 0)}
                            className="w-24"
                          />
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveBalance(user.id, editBalance)}
                            disabled={savingId === user.id}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-muted p-2 rounded"
                          onClick={() => {
                            setEditingId(user.id)
                            setEditBalance(user.generation_balance)
                          }}
                        >
                          {user.generation_balance}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{user.generation_used}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetUsed(user.id)}
                        disabled={savingId === user.id}
                      >
                        Reset
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