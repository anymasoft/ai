"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getHistory, formatDate, getFormatDisplay, type HistoryItem } from "@/lib/history"

export default function HistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])

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

  return (
    <BaseLayout title="History" description="Your generated code history">
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
          <div className="grid gap-4">
            {history.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">
                          {item.sourceType === "image" ? "📷" : "🌐"} {item.sourceLabel}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {getFormatDisplay(item.format)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                    <Button
                      onClick={() => handleOpen(item)}
                      variant="default"
                      size="sm"
                    >
                      Open
                    </Button>
                  </div>
                  {item.instructions && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {item.instructions}
                    </p>
                  )}
                  <div className="bg-muted p-3 rounded text-xs overflow-hidden max-h-20">
                    <code className="line-clamp-3">{item.result.slice(0, 200)}</code>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </BaseLayout>
  )
}
