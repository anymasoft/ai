"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useUser } from "@/hooks/useUser"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Trash2, Loader2, AlertCircle, Scale } from "lucide-react"
import Link from "next/link"
import { ChannelAvatar } from "@/components/channel-avatar"

interface Competitor {
  id: number
  userId: string
  platform: string
  channelId: string
  handle: string
  title: string
  avatarUrl: string | null
  subscriberCount: number
  videoCount: number
  viewCount: number
  lastSyncedAt: number
  createdAt: number
}

export default function CompetitorsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { user } = useUser()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [handle, setHandle] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [fetching, setFetching] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [competitorToDelete, setCompetitorToDelete] = useState<number | null>(null)

  useEffect(() => {
    fetchCompetitors()
  }, [])

  async function fetchCompetitors() {
    try {
      setFetching(true)
      const res = await fetch("/api/competitors")
      if (res.ok) {
        const data = await res.json()
        setCompetitors(data)
      }
    } catch (err) {
      console.error("Failed to fetch competitors:", err)
    } finally {
      setFetching(false)
    }
  }

  async function handleAddCompetitor(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!handle.trim()) {
      setError("Введите название канала или ссылку на YouTube-канал")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Ошибка добавления конкурента")
        return
      }

      setSuccess("Конкурент успешно добавлен!")
      setHandle("")
      fetchCompetitors()
    } catch (err) {
      setError("Произошла ошибка при добавлении конкурента")
    } finally {
      setLoading(false)
    }
  }

  function openDeleteDialog(id: number, e: React.MouseEvent) {
    e.stopPropagation() // Prevent row click
    setCompetitorToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!competitorToDelete) return

    try {
      const res = await fetch(`/api/competitors/${competitorToDelete}`, { method: "DELETE" })
      if (res.ok) {
        setSuccess("Конкурент успешно удалён")
        fetchCompetitors()
      } else {
        const data = await res.json()
        setError(data.error || "Ошибка удаления конкурента")
      }
    } catch (err) {
      setError("Произошла ошибка при удалении конкурента")
    } finally {
      setDeleteDialogOpen(false)
      setCompetitorToDelete(null)
    }
  }

  function handleRowClick(competitorId: number) {
    router.push(`/channel/${competitorId}`)
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M"
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K"
    }
    return num.toString()
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="container mx-auto px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Анализ конкурентов</h1>
          <p className="text-muted-foreground">Отслеживайте и анализируйте ваших конкурентов</p>
        </div>
        {competitors.length >= 2 && (
          <Link href="/competitors/compare">
            <Button variant="default">
              <Scale className="mr-2 h-4 w-4" />
              Сравнить всех
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Добавить конкурента</CardTitle>
          <CardDescription>
            Добавьте YouTube канал для отслеживания
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCompetitor} className="flex gap-2">
            <Input
              type="text"
              placeholder="Введите название канала или ссылку на YouTube-канал"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Добавить
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ваши конкуренты</CardTitle>
          <CardDescription>
            Управляйте и просматривайте отслеживаемых конкурентов
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : competitors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Конкуренты не добавлены. Добавьте первого конкурента выше.
            </p>
          ) : (
            <Table style={{ tableLayout: 'fixed' }}>
              <TableHeader>
                <TableRow>
                  <TableHead>Канал</TableHead>
                  <TableHead>Подписчики</TableHead>
                  <TableHead>Видео</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((competitor) => (
                  <TableRow
                    key={competitor.id}
                    onClick={() => handleRowClick(competitor.id)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 truncate">
                        <ChannelAvatar
                          src={competitor.avatarUrl}
                          alt={competitor.title}
                          className="h-8 w-8 flex-shrink-0"
                        />
                        <div className="truncate min-w-0">
                          <div className="font-medium truncate overflow-hidden text-ellipsis" title={competitor.title}>{competitor.title}</div>
                          <div className="text-xs text-muted-foreground truncate overflow-hidden text-ellipsis" title={competitor.handle}>
                            {competitor.handle}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatNumber(competitor.subscriberCount)}
                    </TableCell>
                    <TableCell>{formatNumber(competitor.videoCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить конкурента?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этого конкурента? Это действие необратимо и удалит все связанные данные.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
