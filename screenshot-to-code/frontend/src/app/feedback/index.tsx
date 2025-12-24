import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Send, MessageSquare, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { fetchJSON, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

export default function FeedbackPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!message.trim()) {
      toast.error("Введите сообщение")
      return
    }

    if (message.trim().length < 10) {
      toast.error("Сообщение должно содержать минимум 10 символов")
      return
    }

    try {
      setLoading(true)

      await fetchJSON("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
        }),
      })

      setSuccess(true)
      setMessage("")
      toast.success("Сообщение отправлено!")
    } catch (error) {
      console.error("Error:", error)
      if (error instanceof ApiError) {
        toast.error(error.data?.detail?.message || error.data?.message || "Ошибка при отправке сообщения")
      } else {
        toast.error("Ошибка при отправке сообщения")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="h-8 w-8" />
          Обратная связь
        </h1>
        <p className="text-muted-foreground mt-2">
          Напишите нам ваши вопросы, предложения или сообщите о проблеме
        </p>
      </div>

      {success ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4 py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-semibold">Сообщение отправлено!</h3>
              <p className="text-muted-foreground">
                Спасибо за обратную связь. Мы свяжемся с вами в ближайшее время.
              </p>
              <Button onClick={() => setSuccess(false)} variant="outline">
                Отправить ещё
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="message">
                  Сообщение <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  placeholder="Опишите ваш вопрос или проблему..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="resize-vertical min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Минимум 10 символов
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Отправить
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
