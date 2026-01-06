"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Download, Plus, RefreshCw, Loader2, FileText, Image } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface DashboardHeaderProps {
  onPeriodChange?: (period: string) => void
  currentPeriod?: string
}

export function DashboardHeader({ onPeriodChange, currentPeriod = "30" }: DashboardHeaderProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dashboardRef = useRef<HTMLDivElement>(null)

  const handleSync = async () => {
    setSyncing(true)
    try {
      router.refresh()
    } finally {
      setTimeout(() => setSyncing(false), 1000)
    }
  }

  const handleExport = async (format: "png" | "pdf") => {
    setExporting(true)
    try {
      // Dynamic import to avoid SSR issues
      if (format === "png") {
        const html2canvas = (await import("html2canvas")).default
        const dashboard = document.querySelector("[data-dashboard-content]")
        if (dashboard) {
          const canvas = await html2canvas(dashboard as HTMLElement, {
            backgroundColor: "#0a0a0a",
            scale: 2,
          })
          const link = document.createElement("a")
          link.download = `dashboard-${new Date().toISOString().split("T")[0]}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        }
      } else {
        // For PDF, we'll use browser print
        window.print()
      }
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      {/* Title Section */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          YouTube Аналитика
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Отслеживайте производительность конкурентов и находите популярный контент
        </p>
      </div>

      {/* Actions Section */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Date Filter */}
        <Select value={currentPeriod} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[140px] h-9 text-sm bg-background/50 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 дней</SelectItem>
            <SelectItem value="30">30 дней</SelectItem>
            <SelectItem value="90">90 дней</SelectItem>
          </SelectContent>
        </Select>

        {/* Export Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-background/50 backdrop-blur-sm border-border/50 hover:border-border"
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              <span className="hidden sm:inline">Экспорт</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("png")} className="gap-2 cursor-pointer">
              <Image className="w-4 h-4" />
              Экспортировать как PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4" />
              Печать / PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="h-9 bg-background/50 backdrop-blur-sm border-border/50 hover:border-border"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
        </Button>

        {/* Add Channel Button */}
        <Button size="sm" asChild className="h-9 gap-2">
          <Link href="/competitors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Добавить канал</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
