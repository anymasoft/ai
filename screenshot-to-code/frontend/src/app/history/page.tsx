"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getHistory, formatDate, getFormatDisplay, type HistoryItem } from "@/lib/history"

const ITEMS_PER_PAGE = 10

export default function HistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    console.log("History page mounted - loading history")
    const loaded = getHistory()
    console.log("Loaded history items:", loaded.length)
    setHistory(loaded)
  }, [])

  const handleOpen = (item: HistoryItem) => {
    // Store the item in sessionStorage to pass to playground
    sessionStorage.setItem("playground_load", JSON.stringify(item))
    navigate("/playground")
  }

  // Pagination logic
  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentItems = history.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground">Your generated code history</p>
        </div>
      </div>
      <div className="@container/main px-4 lg:px-6 space-y-6">
        {history.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">No generations yet</p>
              <p className="text-sm text-muted-foreground">
                Your generated code will appear here.
              </p>
              <Button
                onClick={() => navigate("/playground")}
                variant="default"
                className="mt-4"
              >
                Start generating
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {currentItems.map((item) => (
                <Card
                  key={item.id}
                  className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleOpen(item)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {item.sourceType === "image" ? "📷" : "🌐"} {item.sourceLabel}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {getFormatDisplay(item.format)}
                        </Badge>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    {item.instructions && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.instructions}
                      </p>
                    )}
                    <div className="bg-muted/50 px-2 py-1 rounded text-xs overflow-hidden">
                      <code className="line-clamp-1 text-muted-foreground/80">
                        {item.result.slice(0, 120)}...
                      </code>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first, last, current, and adjacent pages
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          onClick={() => goToPage(page)}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9 p-0"
                        >
                          {page}
                        </Button>
                      )
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-1 text-muted-foreground">
                          ...
                        </span>
                      )
                    }
                    return null
                  })}
                </div>
                <Button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
