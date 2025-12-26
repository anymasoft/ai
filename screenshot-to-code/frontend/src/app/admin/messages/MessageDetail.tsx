import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ArrowLeft, Trash2, Mail, User, Calendar } from "lucide-react"
import { toast } from "sonner"
import { fetchJSON, ApiError } from "@/lib/api"

interface Message {
  id: string
  email: string
  firstName: string
  lastName: string
  subject: string
  message: string
  userId: string | null
  createdAt: number
  isRead: number
}

export default function MessageDetail() {
  const navigate = useNavigate()
  const { id: messageId } = useParams<{ id: string }>()

  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (messageId) {
      fetchMessage()
    }
  }, [messageId])

  async function fetchMessage() {
    try {
      setLoading(true)

      const data = await fetchJSON<Message>(`/api/admin/messages/${messageId}`)
      setMessage(data)

      // Mark as read if not already
      if (data.isRead === 0) {
        markAsRead()
      }
    } catch (error) {
      console.error("Error:", error)
      if (error instanceof ApiError && error.status === 404) {
        toast.error("Сообщение не найдено")
        navigate("/app/admin/messages")
      } else {
        toast.error("Ошибка при загрузке сообщения")
      }
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead() {
    try {
      await fetchJSON(`/api/admin/messages/${messageId}/read`, {
        method: "PATCH",
      })

      // Update local state
      setMessage((prev) => (prev ? { ...prev, isRead: 1 } : null))
    } catch (error) {
      console.error("Error marking as read:", error)
    }
  }

  function openDeleteConfirm() {
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    try {
      setDeleting(true)

      await fetchJSON(`/api/admin/messages/${messageId}`, {
        method: "DELETE",
      })

      toast.success("Сообщение удалено")
      navigate("/app/admin/messages")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при удалении сообщения")
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!message) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Сообщение не найдено</p>
          <Button
            variant="outline"
            onClick={() => navigate("/app/admin/messages")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к списку
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/app/admin/messages")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к списку
        </Button>
        <Button
          variant="destructive"
          onClick={openDeleteConfirm}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Удалить
        </Button>
      </div>

      {/* Message Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{message.subject}</CardTitle>
              <div className="flex items-center gap-2">
                {message.isRead ? (
                  <Badge variant="secondary">Прочитано</Badge>
                ) : (
                  <Badge variant="default">Новое</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sender Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">
                  {message.firstName} {message.lastName}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {message.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(message.createdAt)}
            </div>
          </div>

          <Separator />

          {/* Message Content */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">Сообщение:</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.message}
              </p>
            </div>
          </div>

          {/* User ID (if exists) */}
          {message.userId && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  ID пользователя:
                </h3>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {message.userId}
                </code>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить сообщение</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить это сообщение? Это действие невозможно отменить.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Отменить
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
