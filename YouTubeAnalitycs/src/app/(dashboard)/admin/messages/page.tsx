"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Mail } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

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

export default function AdminMessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null)

  useEffect(() => {
    fetchMessages()
  }, [])

  async function fetchMessages() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/messages")
      if (!res.ok) throw new Error("Failed to fetch messages")
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при загрузке сообщений")
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(messageId: string) {
    try {
      setMarkingAsRead(messageId)
      const res = await fetch(`/api/admin/messages/${messageId}/read`, {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Failed to mark as read")

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isRead: 1 } : msg
        )
      )

      toast.success("Отмечено как прочитано")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при обновлении статуса")
    } finally {
      setMarkingAsRead(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), "dd.MM.yyyy HH:mm", { locale: ru })
  }

  const truncateMessage = (text: string, lines: number = 2) => {
    const lineArray = text.split("\n")
    if (lineArray.length > lines) {
      return lineArray.slice(0, lines).join("\n") + "..."
    }
    return text.length > 100 ? text.substring(0, 100) + "..." : text
  }

  const unreadCount = messages.filter((m) => !m.isRead).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Сообщения обратной связи</h1>
          <p className="text-muted-foreground">
            Всего: {messages.length} | Непрочитано: {unreadCount}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchMessages}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Входящие сообщения
          </CardTitle>
          <CardDescription>
            Нажмите на сообщение для подробного просмотра
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Сообщений нет
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table className="w-full" style={{ tableLayout: 'fixed' }}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">От кого</TableHead>
                    <TableHead className="w-[150px]">Тема</TableHead>
                    <TableHead>Сообщение</TableHead>
                    <TableHead className="w-[120px]">Дата</TableHead>
                    <TableHead className="w-[80px]">Статус</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow
                      key={message.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/admin/messages/${message.id}`)}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="truncate">{message.firstName} {message.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate" title={message.email}>
                          {message.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium truncate overflow-hidden text-ellipsis" title={message.subject}>
                        {message.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate overflow-hidden text-ellipsis">
                        {truncateMessage(message.message)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(message.createdAt)}
                      </TableCell>
                      <TableCell>
                        {message.isRead ? (
                          <Badge variant="secondary">Прочитано</Badge>
                        ) : (
                          <Badge variant="default">Новое</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!message.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(message.id)
                            }}
                            disabled={markingAsRead === message.id}
                          >
                            {markingAsRead === message.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Прочитать"
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
