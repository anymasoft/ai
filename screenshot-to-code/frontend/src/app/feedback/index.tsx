import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Send, MessageSquare } from "lucide-react"
import { toast } from "sonner"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:7001"

export default function FeedbackPage() {
  const [loading, setLoading] = useState(false)
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

      const userEmail = localStorage.getItem("user_email") || "user@screen2code.com"

      const res = await fetch(`${BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message.trim(),
          email: userEmail,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail?.message || "Не удалось отправить сообщение")
      }

      toast.success("Сообщение отправлено!")
      setMessage("")
    } catch (error) {
      console.error("Error:", error)
      toast.error(error instanceof Error ? error.message : "Ошибка при отправке сообщения")
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

      <Card>
        <CardHeader>
          <CardTitle>Отправить сообщение</CardTitle>
          <CardDescription>
            Мы ответим вам в ближайшее время
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                rows={10}
                className="resize-none"
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
    </div>
  )
}
