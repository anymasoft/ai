"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { PLAN_LIMITS } from "@/lib/plan-limits"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

interface AIInsight {
  id: number
  competitorId: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  recommendations: string[]
  createdAt: number
}

export default function CompetitorsPage() {
  const { data: session } = useSession()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [handle, setHandle] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [fetching, setFetching] = useState(true)

  // AI Analysis states
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)

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

  async function handleDeleteCompetitor(id: number) {
    if (!confirm("Are you sure you want to remove this competitor?")) {
      return
    }

    try {
      const res = await fetch(`/api/competitors/${id}`, { method: "DELETE" })
      if (res.ok) {
        setSuccess("Competitor removed successfully")
        fetchCompetitors()
      } else {
        const data = await res.json()
        setError(data.error || "Failed to delete competitor")
      }
    } catch (err) {
      setError("An error occurred while deleting the competitor")
    }
  }

  async function handleAIAnalysis(competitor: Competitor) {
    setSelectedCompetitor(competitor)
    setAiDialogOpen(true)
    setAiLoading(true)
    setAiInsight(null)
    setError("")

    try {
      const res = await fetch(`/api/channel/${competitor.id}/summary`, {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to generate AI analysis")
        return
      }

      setAiInsight(data)
    } catch (err) {
      setError("An error occurred while generating AI analysis")
    } finally {
      setAiLoading(false)
    }
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Competitors Analysis</h1>
        <p className="text-muted-foreground">Track and analyze your competition</p>
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
                  <TableRow key={competitor.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {competitor.avatarUrl && (
                          <img
                            src={competitor.avatarUrl}
                            alt={competitor.title}
                            className="h-8 w-8 rounded-full"
                          />
                        )}
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAIAnalysis(competitor)}
                          className="cursor-pointer"
                          title="AI-анализ канала"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCompetitor(competitor.id)}
                          className="cursor-pointer"
                          title="Удалить конкурента"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-анализ канала: {selectedCompetitor?.title}
            </DialogTitle>
            <DialogDescription>
              Автоматический SWOT-анализ на основе метрик канала
            </DialogDescription>
          </DialogHeader>

          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Генерируем AI-анализ...</p>
              <p className="text-sm text-muted-foreground mt-2">Это может занять 10-15 секунд</p>
            </div>
          ) : aiInsight ? (
            <div className="space-y-6">
              {/* Summary */}
              <div>
                <h3 className="font-semibold text-lg mb-2">📊 Краткая сводка</h3>
                <p className="text-muted-foreground">{aiInsight.summary}</p>
              </div>

              {/* Strengths */}
              <div>
                <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-500">
                  💪 Сильные стороны
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {aiInsight.strengths.map((strength, idx) => (
                    <li key={idx} className="text-muted-foreground">{strength}</li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div>
                <h3 className="font-semibold text-lg mb-2 text-red-600 dark:text-red-500">
                  ⚠️ Слабые стороны
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {aiInsight.weaknesses.map((weakness, idx) => (
                    <li key={idx} className="text-muted-foreground">{weakness}</li>
                  ))}
                </ul>
              </div>

              {/* Opportunities */}
              <div>
                <h3 className="font-semibold text-lg mb-2 text-blue-600 dark:text-blue-500">
                  🚀 Возможности
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {aiInsight.opportunities.map((opportunity, idx) => (
                    <li key={idx} className="text-muted-foreground">{opportunity}</li>
                  ))}
                </ul>
              </div>

              {/* Threats */}
              <div>
                <h3 className="font-semibold text-lg mb-2 text-orange-600 dark:text-orange-500">
                  ⚡ Угрозы
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {aiInsight.threats.map((threat, idx) => (
                    <li key={idx} className="text-muted-foreground">{threat}</li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="font-semibold text-lg mb-2 text-purple-600 dark:text-purple-500">
                  💡 Рекомендации
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {aiInsight.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-muted-foreground">{rec}</li>
                  ))}
                </ul>
              </div>

              <div className="text-xs text-muted-foreground pt-4 border-t">
                Анализ сгенерирован: {new Date(aiInsight.createdAt).toLocaleString("ru-RU")}
              </div>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
