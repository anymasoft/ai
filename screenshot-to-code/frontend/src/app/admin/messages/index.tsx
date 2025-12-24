import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Mail, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react"
import { toast } from "sonner"

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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:7001"

export default function AdminMessagesPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [emailFilter, setEmailFilter] = useState("")
  const [searchEmail, setSearchEmail] = useState("")
  const [readStatus, setReadStatus] = useState<"all" | "unread" | "read">("all")

  useEffect(() => {
    fetchMessages()
  }, [currentPage, emailFilter, readStatus])

  async function fetchMessages() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("page", currentPage.toString())
      if (emailFilter) {
        params.set("email", emailFilter)
      }
      if (readStatus !== "all") {
        params.set("readStatus", readStatus)
      }

      const adminEmail = localStorage.getItem("dev_admin_email") || "admin@screen2code.com"

      const res = await fetch(`${BACKEND_URL}/api/admin/messages?${params.toString()}`, {
        headers: {
          "X-Admin-Email": adminEmail,
        },
      })

      if (!res.ok) throw new Error("Failed to fetch messages")

      const data = await res.json()
      setMessages(data.messages || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при загрузке сообщений")
    } finally {
      setLoading(false)
    }
  }

  async function deleteMessage(messageId: string) {
    try {
      setDeleting(messageId)
      const adminEmail = localStorage.getItem("dev_admin_email") || "admin@screen2code.com"

      const res = await fetch(`${BACKEND_URL}/api/admin/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Email": adminEmail,
        },
      })

      if (!res.ok) throw new Error("Failed to delete message")

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
      toast.success("Сообщение удалено")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при удалении сообщения")
    } finally {
      setDeleting(null)
    }
  }

  function handleSearch() {
    setCurrentPage(1)
    setEmailFilter(searchEmail)
  }

  function handleClearFilter() {
    setCurrentPage(1)
    setEmailFilter("")
    setSearchEmail("")
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("ru-RU")
  }

  const truncateMessage = (text: string) => {
    return text.length > 100 ? text.substring(0, 100) + "..." : text
  }

  const unreadCount = messages.filter((m) => !m.isRead).length

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-8">
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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Фильтр по статусу */}
            <div className="flex gap-2">
              <Button
                variant={readStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentPage(1)
                  setReadStatus("all")
                }}
              >
                Все
              </Button>
              <Button
                variant={readStatus === "unread" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentPage(1)
                  setReadStatus("unread")
                }}
              >
                Новые
              </Button>
              <Button
                variant={readStatus === "read" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentPage(1)
                  setReadStatus("read")
                }}
              >
                Прочитанные
              </Button>
            </div>

            {/* Фильтр по email */}
            <div className="flex gap-2">
              <Input
                placeholder="Поиск по email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
                className="w-48"
              />
              <Button onClick={handleSearch} variant="default" size="sm">
                Поиск
              </Button>
              {emailFilter && (
                <Button
                  onClick={handleClearFilter}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Очистить фильтр"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Сообщений нет
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">От кого</TableHead>
                    <TableHead>Сообщение</TableHead>
                    <TableHead className="w-[150px]">Дата</TableHead>
                    <TableHead className="w-[100px]">Статус</TableHead>
                    <TableHead className="w-[80px] text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow
                      key={message.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/messages/${message.id}`)}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="truncate">
                          {message.firstName} {message.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={message.email}>
                          {message.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {truncateMessage(message.message)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(message.createdAt)}
                      </TableCell>
                      <TableCell>
                        {message.isRead ? (
                          <Badge variant="secondary">Прочитано</Badge>
                        ) : (
                          <Badge variant="default">Новое</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteMessage(message.id)
                          }}
                          disabled={deleting === message.id}
                          title="Удалить сообщение"
                        >
                          {deleting === message.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Пагинация */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Страница {currentPage} из {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
