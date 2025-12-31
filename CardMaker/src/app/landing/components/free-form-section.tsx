"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
      const mockResult = `${prompt}\n\nОсновные характеристики:\n• Надежность и качество\n• Оптимальная цена\n• Быстрая доставка\n• Гарантия от производителя\n\nИдеально для тех, кто ценит соотношение цены и качества.`
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
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Badge variant="outline" className="mb-4 border-green-600/50 text-green-700 dark:text-green-400">
            Проходит требования Ozon / Wildberries
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            Попробуй бесплатно
          </h2>
          <p className="text-muted-foreground">
            Сгенерируй готовое описание товара за один клик
          </p>
        </div>

        {/* Prompt Input - Simplified Form */}
        <div className="space-y-4">
          <div className="relative group">
            <Textarea
              placeholder="Умные часы с GPS и пульсометром. Экран 1.69&quot;, влагозащита IP67, 30 часов работы, совместимы с iOS и Android, подходят для спорта и повседневного использования."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none rounded-2xl border-2 border-border/50 p-4 text-base transition-all hover:border-border/80 focus:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Generate Button - Compact Icon Only */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="group relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Сгенерировать описание"
            >
              {isGenerating ? (
                <Sparkles className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5 transition-transform group-hover:scale-110" />
              )}
            </button>
            <span className="text-sm text-muted-foreground">
              {isGenerating ? "Генерирую..." : "Нажми для генерации"}
            </span>
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground mt-3">
            В бесплатной версии требования маркетплейсов не проверяются
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 space-y-3">
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

            {/* CTA - Compact */}
            <Link href="/sign-in">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg h-9"
              >
                Полная версия с SEO и стилями
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
