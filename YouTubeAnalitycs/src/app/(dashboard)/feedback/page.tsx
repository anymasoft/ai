"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState } from "react"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { toast } from "sonner"

const feedbackFormSchema = z.object({
  message: z.string().min(10, {
    message: "Сообщение должно быть не менее 10 символов.",
  }),
})

export default function FeedbackPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const form = useForm<z.infer<typeof feedbackFormSchema>>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      message: "",
    },
  })

  async function onSubmit(values: z.infer<typeof feedbackFormSchema>) {
    try {
      setLoading(true)
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка отправки формы")
      }

      setSuccess(true)
      form.reset()
      toast.success("Ваше сообщение успешно отправлено!")

      setTimeout(() => setSuccess(false), 5000)
    } catch (error) {
      console.error("Error:", error)
      toast.error(error instanceof Error ? error.message : "Ошибка отправки формы")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Отправьте нам свои предложения, вопросы или сообщения об ошибках
        </p>
      </div>

      <div>
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Отправить сообщение
          </CardTitle>
          <CardDescription>
            Мы ценим ваше мнение и постараемся ответить как можно скорее
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-900">Спасибо за вашу обратную связь!</h3>
                <p className="text-sm text-green-700 mt-1">
                  Мы получили ваше сообщение и ответим в ближайшее время
                </p>
              </div>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ваше сообщение</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Расскажите подробнее о вашем вопросе или предложении..."
                        rows={10}
                        className="min-h-50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full cursor-pointer gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Отправлено
                  </>
                ) : (
                  "Отправить сообщение"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
