"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react"
import { getHistory, deleteHistoryItem, clearHistory, formatDate, getFormatDisplay, type HistoryItem } from "@/lib/history"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const ITEMS_PER_PAGE = 10

export default function HistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      console.log("History page mounted - loading history")
      const loaded = await getHistory()
      console.log("Loaded history items:", loaded.length)
      setHistory(loaded)
      setCurrentPage(1)
    } catch (error) {
      console.error("Error loading history:", error)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = (item: HistoryItem) => {
    // Store the item in sessionStorage to pass to playground
    sessionStorage.setItem("playground_load", JSON.stringify(item))
    navigate("/playground")
  }

  const handleDeleteItem = async (id: string) => {
    try {
      setDeleting(id)
      const success = await deleteHistoryItem(id)
      if (success) {
        // Remove from local state
        const updated = history.filter(item => item.id !== id)
        setHistory(updated)

        // Reset pagination if needed
        const totalPages = Math.ceil(updated.length / ITEMS_PER_PAGE)
        if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages)
        }
      }
    } catch (error) {
      console.error("Error deleting item:", error)
    } finally {
      setDeleting(null)
    }
  }

  const handleClearAll = async () => {
    try {
      setIsClearing(true)
      const success = await clearHistory()
      if (success) {
        setHistory([])
        setCurrentPage(1)
        setShowClearDialog(false)
      }
    } catch (error) {
      console.error("Error clearing history:", error)
    } finally {
      setIsClearing(false)
    }
  }

  // Pagination logic
  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentItems = history.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">История</h1>
              <p className="text-muted-foreground">История вашего сгенерированного кода</p>
            </div>
            {history.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Очистка...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Очистить всё
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="@container/main px-4 lg:px-6 space-y-6">
        {history.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Операции отсутствуют</p>
              <p className="text-sm text-muted-foreground">
                Ваш сгенерированный код появится здесь.
              </p>
              <Button
                onClick={() => navigate("/playground")}
                variant="default"
                className="mt-4"
              >
                Начать генерирование
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {currentItems.map((item) => (
                <Card
                  key={item.id}
                  className="p-3 flex items-start justify-between gap-4 hover:bg-accent/50 transition-colors group"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleOpen(item)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
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
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteItem(item.id)
                    }}
                    disabled={deleting === item.id}
                  >
                    {deleting === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
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
                  Назад
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
                  Далее
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear History Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистить всю историю?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все {history.length} записей будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить всё'
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
