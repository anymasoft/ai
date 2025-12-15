"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Mail } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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

      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, isRead: 1 })
      }

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
            Клик по сообщению для просмотра полного текста
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">От кого</TableHead>
                    <TableHead className="w-[150px]">Тема</TableHead>
                    <TableHead className="flex-1">Сообщение</TableHead>
                    <TableHead className="w-[140px]">Дата</TableHead>
                    <TableHead className="w-[100px]">Статус</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow
                      key={message.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedMessage(message)
                        setIsDialogOpen(true)
                      }}
                    >
                      <TableCell className="font-medium">
                        {message.firstName} {message.lastName}
                        <br />
                        <span className="text-sm text-muted-foreground">
                          {message.email}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {message.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
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

      {/* Dialog для полного просмотра сообщения */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
            <DialogDescription>
              От: {selectedMessage?.firstName} {selectedMessage?.lastName} (
              {selectedMessage?.email})
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg text-sm">
                <p className="font-medium mb-2">
                  {formatDate(selectedMessage.createdAt)}
                </p>
                <p className="whitespace-pre-wrap text-foreground">
                  {selectedMessage.message}
                </p>
              </div>

              {!selectedMessage.isRead && (
                <Button
                  onClick={() => {
                    markAsRead(selectedMessage.id)
                    setIsDialogOpen(false)
                  }}
                  disabled={markingAsRead === selectedMessage.id}
                  className="w-full gap-2"
                >
                  {markingAsRead === selectedMessage.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Отмечается...
                    </>
                  ) : (
                    "Отметить как прочитанное"
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
