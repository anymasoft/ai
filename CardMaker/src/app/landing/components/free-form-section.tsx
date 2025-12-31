"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Copy, Sparkles, Check } from "lucide-react"
import { toast } from "sonner"

export function FreeFormSection() {
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Заполни описание товара")
      return
    }

    setIsGenerating(true)
    setTimeout(() => {
      // Mock результат
      const mockResult = `${prompt}\n\nОсновные характеристики:\n• Подходит для повседневного использования и спорта\n• Совместим с популярными смартфонами\n• Удобен в настройке и использовании\n• Продуман для длительной эксплуатации\n\nХороший выбор для тех, кто ищет функциональность без переплаты.`
      setResult(mockResult)
      setIsGenerating(false)
      toast.success("Описание создано!")
    }, 1000)
  }

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      toast.success("Скопировано!")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <section className="py-16 md:py-24 px-4 md:px-6 lg:px-0">
      <div className="max-w-2xl mx-auto">
        {/* Header - Centered */}
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-4 border-green-600/50 text-green-700 dark:text-green-400 inline-block">
            Проходит требования Ozon / Wildberries
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-center">
            Попробуйте бесплатно
          </h2>
          <p className="text-muted-foreground text-center">
            Получите готовое описание товара за один шаг
          </p>
        </div>

        {/* Prompt Input - Premium Style */}
        <div className="space-y-6 mb-8">
          <div className="relative group">
            {/* Glow effect background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Textarea container */}
            <div className="relative">
              <Textarea
                placeholder="Умные часы с GPS и пульсометром. Экран 1.69&quot;, влагозащита IP67, 30 часов работы, совместимы с iOS и Android, подходят для спорта и повседневного использования."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={10}
                className="resize-none rounded-2xl border-2 border-gradient-to-r from-primary/50 via-primary/30 to-primary/50 p-5 text-base bg-card transition-all duration-300 focus:border-primary focus:shadow-lg focus:shadow-primary/20 focus-visible:outline-none focus-visible:ring-0 hover:border-primary/70 min-h-48"
              />

              {/* Generate Button - Inside Textarea */}
              <button
                onClick={handleGenerate}
                disabled={false}
                className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-200 hover:shadow-lg hover:shadow-primary/50 hover:scale-110 active:scale-95"
                title="Сгенерировать описание"
              >
                {isGenerating ? (
                  <Sparkles className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            В бесплатной версии требования маркетплейсов не проверяются
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-4 mb-8">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="pt-6 relative">
                {/* Copy Button - Icon in Top Right */}
                <button
                  onClick={handleCopy}
                  className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  title="Скопировать"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap pr-10">
                  {result}
                </p>
              </CardContent>
            </Card>

            {/* CTA - Compact, Centered */}
            <div className="flex justify-center">
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg h-9"
                >
                  Расширенные возможности для карточек товаров
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Features Comparison - Restored */}
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Бесплатно</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div>✓ Простое описание товара</div>
              <div>✓ Простой интерфейс</div>
              <div>✓ Доступно без регистрации</div>
              <div className="text-xs mt-3 pt-2 border-t">Отлично для быстрой пробы</div>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">Расширенный доступ</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div>✓ Учёт поисковых запросов</div>
              <div>✓ Несколько вариантов подачи текста</div>
              <div>✓ Сравнение с товарами конкурентов</div>
              <div>✓ Проверка требований Ozon и Wildberries</div>
              <div>✓ История и экспорт</div>
              <div className="text-xs mt-3 pt-2 border-t">Требует регистрации (бесплатная пробная версия)</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
