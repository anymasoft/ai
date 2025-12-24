import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Send, MessageSquare } from "lucide-react"
import { toast } from "sonner"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:7001"

export default function FeedbackPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    message: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.email || !formData.message) {
      toast.error("Email и сообщение обязательны")
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail?.error || "Failed to send feedback")
      }

      toast.success("Сообщение отправлено!")
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        message: "",
      })
    } catch (error) {
      console.error("Error:", error)
      toast.error("Ошибка при отправке сообщения")
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
            Мы ответим вам на указанный email в ближайшее время
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Имя</Label>
                <Input
                  id="firstName"
                  placeholder="Иван"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  placeholder="Иванов"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">
                Сообщение <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Опишите ваш вопрос или проблему..."
                value={formData.message}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, message: e.target.value }))
                }
                required
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Минимум 10 символов
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Отправить
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
