"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Mail } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"

interface Message {
  id: string
  email: string
  firstName: string
  lastName: string
  subject: string
  message: string
  createdAt: number
  isRead: number
}

export default function MessageDetailPage() {
  const router = useRouter()
  const params = useParams()
  const messageId = params.id as string

  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [markingAsRead, setMarkingAsRead] = useState(false)

  useEffect(() => {
    fetchMessage()
  }, [messageId])

  async function fetchMessage() {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/messages/${messageId}`)
      if (!res.ok) throw new Error("Failed to fetch message")
      const data = await res.json()
      setMessage(data.message)

      // Mark as read when viewing
      if (data.message && !data.message.isRead) {
        await markAsRead()
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при загрузке сообщения")
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead() {
    try {
      setMarkingAsRead(true)
      const res = await fetch(`/api/admin/messages/${messageId}/read`, {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Failed to mark as read")

      setMessage((prev) => prev ? { ...prev, isRead: 1 } : null)
      toast.success("Отмечено как прочитано")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при обновлении статуса")
    } finally {
      setMarkingAsRead(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), "dd.MM.yyyy HH:mm", { locale: ru })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!message) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div className="py-8 text-center text-muted-foreground">
          Сообщение не найдено
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Назад к списку
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardDescription className="text-base">
                От: <span className="font-medium text-foreground">{message.firstName} {message.lastName}</span>
              </CardDescription>
              <CardDescription className="text-base">
                Email: <span className="font-medium text-foreground">{message.email}</span>
              </CardDescription>
              <CardDescription className="text-base">
                Дата: <span className="font-medium text-foreground">{formatDate(message.createdAt)}</span>
              </CardDescription>
            </div>
            <div>
              {message.isRead ? (
                <Badge variant="secondary" className="text-base px-3 py-1">
                  Прочитано
                </Badge>
              ) : (
                <Badge variant="default" className="text-base px-3 py-1">
                  Новое
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/30 p-6 rounded-lg">
            <p className="text-sm font-semibold text-muted-foreground mb-4">Сообщение:</p>
            <p className="whitespace-pre-wrap text-foreground leading-relaxed">
              {message.message}
            </p>
          </div>

          {!message.isRead && (
            <Button
              onClick={markAsRead}
              disabled={markingAsRead}
              className="w-full gap-2"
              size="lg"
            >
              {markingAsRead ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отмечается...
                </>
              ) : (
                "Отметить как прочитанное"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
