"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileText,
  Download,
  Loader2,
  Map,
  Sparkles,
  TrendingUp,
  ScrollText,
  AlertCircle,
  CheckCircle2
} from "lucide-react"

interface Script {
  id: string
  title: string
  createdAt: number
}

interface ReportCardProps {
  title: string
  description: string
  icon: React.ReactNode
  badge?: string
  disabled?: boolean
  loading?: boolean
  onDownload: () => void
  children?: React.ReactNode
}

function ReportCard({
  title,
  description,
  icon,
  badge,
  disabled,
  loading,
  onDownload,
  children
}: ReportCardProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-all duration-300 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              {badge && (
                <Badge variant="outline" className="mt-1 text-xs bg-background/50">
                  {badge}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <CardDescription className="mt-2 text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end gap-4">
        {children}
        <Button
          onClick={onDownload}
          disabled={disabled || loading}
          className="w-full gap-2"
          variant={disabled ? "outline" : "default"}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

function ReportsPageSkeleton() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <div className="mb-8">
        <Skeleton className="h-9 w-64 bg-muted/50" />
        <Skeleton className="h-5 w-96 mt-2 bg-muted/30" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg bg-muted/30" />
                <Skeleton className="h-6 w-40 bg-muted/50" />
              </div>
              <Skeleton className="h-16 w-full mt-3 bg-muted/30" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full bg-muted/30" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Загрузка списка скриптов для выбора
  useEffect(() => {
    async function fetchScripts() {
      try {
        const response = await fetch("/api/scripts")
        if (!response.ok) throw new Error("Failed to fetch scripts")
        const data = await response.json()
        setScripts(data.scripts || [])
        if (data.scripts?.length > 0) {
          setSelectedScriptId(data.scripts[0].id)
        }
      } catch (err) {
        console.error("Error fetching scripts:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchScripts()
  }, [])

  const downloadPDF = async (reportType: string, params?: Record<string, string>) => {
    setError(null)
    setSuccess(null)
    setDownloadingReport(reportType)

    try {
      const queryParams = new URLSearchParams(params || {})
      const response = await fetch(`/api/reports/${reportType}?${queryParams.toString()}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to generate ${reportType} report`)
      }

      // Получаем PDF как blob
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      // Создаём ссылку для скачивания и запускаем её
      const link = document.createElement("a")
      link.href = url
      link.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.pdf`
      link.click()

      // Очищаем URL после небольшой задержки, чтобы браузер успел обработать
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)

      setSuccess(`${reportType} report downloaded successfully!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download report")
    } finally {
      setDownloadingReport(null)
    }
  }

  if (loading) {
    return <ReportsPageSkeleton />
  }

  const hasScripts = scripts.length > 0

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Премиальные AI-отчёты</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Создавайте подробные PDF-отчёты на основе вашей аналитики
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Report Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 1. Semantic Map Report */}
        <ReportCard
          title="Semantic Map Report"
          description="Глубокий анализ тем, паттернов, конфликтов, парадоксов и эмоциональных триггеров в роликах конкурентов. Понимание того, почему контент вызывает отклик у аудитории."
          icon={<Map className="h-5 w-5" />}
          badge="AI-Аналитика"
          loading={downloadingReport === "semantic"}
          disabled={!hasScripts}
          onDownload={() => downloadPDF("semantic", { scriptId: selectedScriptId })}
        >
          {hasScripts ? (
            <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue placeholder="Select script for analysis" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Сначала сгенерируйте сценарий, чтобы создать этот отчёт
            </p>
          )}
        </ReportCard>

        {/* 2. Narrative Skeleton Report */}
        <ReportCard
          title="Narrative Skeleton Report"
          description="Полная структура истории: основная идея, ключевой парадокс, конфликт, эмоциональные акценты, композиция сюжета, варианты хука и идеи финала."
          icon={<Sparkles className="h-5 w-5" />}
          badge="Структура истории"
          loading={downloadingReport === "skeleton"}
          disabled={!hasScripts}
          onDownload={() => downloadPDF("skeleton", { scriptId: selectedScriptId })}
        >
          {hasScripts ? (
            <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue placeholder="Select script" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Сначала сгенерируйте сценарий, чтобы создать этот отчёт
            </p>
          )}
        </ReportCard>

        {/* 3. Trending Insights Report */}
        <ReportCard
          title="Trending Insights Report"
          description="Топовые трендовые видео, ключевые метрики, динамика роста, обзор ниши и практические рекомендации на основе анализа конкурентов."
          icon={<TrendingUp className="h-5 w-5" />}
          badge="Анализ ниши"
          loading={downloadingReport === "insights"}
          onDownload={() => downloadPDF("insights", { period: "30" })}
        >
          <Select defaultValue="30">
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">За последние 7 дней</SelectItem>
              <SelectItem value="30">За последние 30 дней</SelectItem>
              <SelectItem value="90">За последние 90 дней</SelectItem>
            </SelectContent>
          </Select>
        </ReportCard>

        {/* 4. Full Script Report */}
        <ReportCard
          title="Full Script Report"
          description="Полный готовый сценарий с заголовком, хуком, детализированным планом, полным текстом сценария и объяснением, почему он должен показывать высокие результаты."
          icon={<ScrollText className="h-5 w-5" />}
          badge="Готовый к использованию"
          loading={downloadingReport === "script"}
          disabled={!hasScripts}
          onDownload={() => downloadPDF("script", { scriptId: selectedScriptId })}
        >
          {hasScripts ? (
            <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue placeholder="Select script" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Сначала сгенерируйте сценарий, чтобы создать этот отчёт
            </p>
          )}
        </ReportCard>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-6 rounded-lg bg-muted/30 border border-border/50">
        <h3 className="text-lg font-semibold mb-2">О премиальных отчётах</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Отчёты создаются по запросу на основе вашей аналитики. Каждый PDF содержит глубокий анализ, практические рекомендации и профессиональное оформление, подходящее как для презентаций, так и для личного использования. Отчёты не сохраняются — скачайте их сразу после генерации.
        </p>
      </div>
    </div>
  )
}
