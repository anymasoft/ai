"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
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
import { Trash2, Loader2, AlertCircle, Scale } from "lucide-react"
import { PLAN_LIMITS } from "@/lib/plan-limits"
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
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [handle, setHandle] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [fetching, setFetching] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [competitorToDelete, setCompetitorToDelete] = useState<number | null>(null)

  const userPlan = session?.user?.plan || "free"
  const limit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] ?? 3

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
      setError("Please enter a channel handle or URL")
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
        setError(data.error || "Failed to add competitor")
        return
      }

      setSuccess("Competitor added successfully!")
      setHandle("")
      fetchCompetitors()
    } catch (err) {
      setError("An error occurred while adding the competitor")
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
        setSuccess("Competitor removed successfully")
        fetchCompetitors()
      } else {
        const data = await res.json()
        setError(data.error || "Failed to delete competitor")
      }
    } catch (err) {
      setError("An error occurred while deleting the competitor")
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

  const isAtLimit = competitors.length >= limit

  return (
    <div className="container mx-auto px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Competitors Analysis</h1>
          <p className="text-muted-foreground">Track and analyze your competition</p>
        </div>
        {competitors.length >= 2 && (
          <Link href="/competitors/compare">
            <Button variant="default">
              <Scale className="mr-2 h-4 w-4" />
              Compare All
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
          <CardTitle>Add Competitor</CardTitle>
          <CardDescription>
            Add a YouTube channel to track ({competitors.length}/{limit} used)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCompetitor} className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter channel handle or URL (e.g., @channelname)"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={loading || isAtLimit}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || isAtLimit} className="cursor-pointer">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </form>
          {isAtLimit && (
            <p className="text-sm text-muted-foreground mt-2">
              You have reached your limit for this plan. Upgrade to add more competitors.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Competitors</CardTitle>
          <CardDescription>
            Manage and view your tracked competitors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : competitors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No competitors added yet. Add your first competitor above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Subscribers</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Total Views</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <div className="flex items-center gap-2">
                        <ChannelAvatar
                          src={competitor.avatarUrl}
                          alt={competitor.title}
                          className="h-8 w-8"
                        />
                        <div>
                          <div className="font-medium">{competitor.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {competitor.handle}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(competitor.subscriberCount)}</TableCell>
                    <TableCell>{formatNumber(competitor.videoCount)}</TableCell>
                    <TableCell>{formatNumber(competitor.viewCount)}</TableCell>
                    <TableCell>{formatDate(competitor.lastSyncedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openDeleteDialog(competitor.id, e)}
                        className="cursor-pointer"
                        title="Удалить конкурента"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
            <AlertDialogTitle>Удалить канал?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот канал? Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
