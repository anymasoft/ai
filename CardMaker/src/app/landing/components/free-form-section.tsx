"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Sparkles } from "lucide-react"
import { toast } from "sonner"

export function FreeFormSection() {
  const [productName, setProductName] = useState("")
  const [features, setFeatures] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = () => {
    if (!productName.trim() || !features.trim()) {
      toast.error("Заполни название и характеристики")
      return
    }

    setIsGenerating(true)
    setTimeout(() => {
      // Mock результат
      const mockResult = `${productName} с лучшими функциями. ${features}. Идеально для тех, кто ценит качество и надежность. Гарантия, быстрая доставка, поддержка.`
      setResult(mockResult)
      setIsGenerating(false)
      toast.success("Описание создано!")
    }, 1000)
  }

  return (
    <section className="py-12 md:py-20 px-4 md:px-6 lg:px-0 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <Badge className="mb-4" variant="outline">
            БЕСПЛАТНАЯ ВЕРСИЯ
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Попробуй бесплатно
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Сгенерируй простое описание товара прямо здесь.
            Для полного функционала (SEO, стили, конкуренты) — авторизуйся в сервисе.
          </p>
        </div>

        {/* Form */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">Генератор описаний</CardTitle>
            <CardDescription>Быстрая генерация базового описания товара</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name" className="font-medium">Название товара</Label>
              <Input
                id="product-name"
                placeholder="Пример: Умные часы"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="features" className="font-medium">Характеристики (кратко)</Label>
              <Textarea
                id="features"
                placeholder="Пример: Bluetooth 5.3, водонепроницаемость IP67, 30 часов батареи, совместимы с iOS/Android"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !productName.trim() || !features.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <span className="h-4 w-4 animate-spin">⚙️</span>
                  Генерирую...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Сгенерировать описание
                </>
              )}
            </Button>

            {/* Result */}
            {result && (
              <div className="bg-muted/50 p-4 rounded-lg border">
                <p className="text-sm font-medium mb-2">Результат:</p>
                <p className="text-sm text-foreground leading-relaxed mb-3">{result}</p>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(result)
                  toast.success("Скопировано!")
                }}>
                  Скопировать текст
                </Button>
              </div>
            )}

            {/* CTA */}
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Нужно больше возможностей?
              </p>
              <Link href="/sign-in">
                <Button className="w-full gap-2" variant="default">
                  Полная версия с SEO, стилями и конкурентами
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Features comparison */}
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Бесплатная версия</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div>✓ Базовое описание товара</div>
              <div>✓ Простой интерфейс</div>
              <div>✓ Без регистрации</div>
              <div className="text-xs mt-3">Отлично для быстрой пробы</div>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">Полная версия</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div>✓ SEO-оптимизация</div>
              <div>✓ 3 стиля описания</div>
              <div>✓ Анализ конкурентов</div>
              <div>✓ История и экспорт</div>
              <div className="text-xs mt-3">Требует регистрации (бесплатная пробная версия)</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
