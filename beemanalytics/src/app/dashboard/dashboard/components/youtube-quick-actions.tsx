"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText, RefreshCw, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function YouTubeQuickActions() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      // Trigger a page refresh to re-fetch data
      router.refresh()
    } finally {
      // Add a small delay for UX
      setTimeout(() => setSyncing(false), 1000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => router.push("/dashboard/competitors")}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add Channel</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/trending")}
            className="gap-2 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Generate Script
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Refresh Data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push("/scripts")}
            className="gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            View Scripts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
