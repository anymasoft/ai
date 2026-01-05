"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Sparkles, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface ValidationResponse {
  ok: boolean
}

type Marketplace = "ozon" | "wb"

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  ozon: "Ozon",
  wb: "Wildberries",
}

export function FreeFormSection() {
  const [text, setText] = useState("")
  const [marketplace, setMarketplace] = useState<Marketplace>("ozon")
  const [isLoading, setIsLoading] = useState(false)
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    if (!text.trim()) {
      toast.error("Заполни описание товара")
      return
    }

    setIsLoading(true)
    setError(null)
    setValidation(null)

    try {
      const response = await fetch("/api/validate-text/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, marketplace }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка при проверке текста")
      }

      const result = await response.json()
      if (result.success && result.data) {
        // Искусственная задержка на лендинге для эмфазы результата (5 сек)
        await new Promise(resolve => setTimeout(resolve, 5000))

        setValidation(result.data)
        if (result.data.ok) {
          toast.success("Описание пройдёт модерацию")
        } else {
          toast.error("Описание не пройдёт модерацию")
        }
      } else {
        throw new Error("Неверный формат ответа от API")
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Неизвестная ошибка"
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePrefill = (intent: "details" | "fix") => {
    const prefill = { marketplace, text, intent }
    localStorage.setItem("beem_validate_prefill", JSON.stringify(prefill))
  }

  return (
    <section className="py-16 md:py-24 px-4 md:px-6 lg:px-0">
      <div className="max-w-2xl mx-auto">
        {/* Header - Centered */}
        <div id="free-form" className="mb-10 text-center scroll-mt-20">
          <Badge variant="outline" className="mb-4 border-blue-600/50 text-blue-700 dark:text-blue-400 inline-block">
            Проверка в один клик
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-center">
            Проверьте описание бесплатно
          </h2>
          <p className="text-muted-foreground text-center">
            Узнайте, соответствует ли ваше описание требованиям маркетплейсов за 10 секунд
          </p>
        </div>

        {/* Marketplace Selector */}
        <div className="mb-6 flex gap-3 justify-center">
          {Object.entries(MARKETPLACE_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMarketplace(value as Marketplace)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                marketplace === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Text Input - Premium Style */}
        <div className="space-y-6 mb-8">
          <div className="relative group">
            {/* Glow effect background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Textarea container */}
            <div className="relative">
              <Textarea
                placeholder="Вставьте описание товара, которое вы хотите проверить. Например: Умные часы с GPS и пульсометром. Экран 1.69&quot;, влагозащита IP67, 30 часов работы, совместимы с iOS и Android..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="resize-none rounded-2xl border-2 border-gradient-to-r from-primary/50 via-primary/30 to-primary/50 p-5 text-base bg-card transition-all duration-300 focus:border-primary focus:shadow-lg focus:shadow-primary/20 focus-visible:outline-none focus-visible:ring-0 hover:border-primary/70 min-h-48"
              />

              {/* Check Button - Inside Textarea */}
              <button
                onClick={handleValidate}
                disabled={isLoading}
                className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-200 hover:shadow-lg hover:shadow-primary/50 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Проверить описание"
              >
                {isLoading ? (
                  <Sparkles className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            Проверка описания по правилам маркетплейсов
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result Summary - Binary PASS/FAIL only */}
        {validation && (
          <div className="space-y-4 mb-8">
            <Card className={validation.ok ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950" : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950"}>
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center justify-center gap-3">
                  {validation.ok ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                      <p className="text-lg font-semibold text-green-900 dark:text-green-100 text-center">
                        Описание пройдёт модерацию
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
                      <p className="text-lg font-semibold text-red-900 dark:text-red-100 text-center">
                        Описание не пройдёт модерацию
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CTA Buttons - Only show if NOT OK */}
            {!validation.ok && (
              <div className="flex flex-col gap-3">
                <Link href="/sign-in" onClick={() => handleSavePrefill("details")}>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Показать проблемные места (1 кредит)
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/sign-in" onClick={() => handleSavePrefill("fix")}>
                  <Button size="sm" className="w-full gap-2 bg-primary hover:bg-primary/90">
                    Исправить автоматически (1 кредит)
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Soft CTA - Only show if OK */}
            {validation.ok && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setText("")
                    setValidation(null)
                  }}
                  className="gap-2"
                >
                  Проверить другое описание
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Features Comparison - Updated for Validator */}
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Бесплатная проверка</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div>✓ Проверка основных требований</div>
              <div>✓ Общий результат (OK / NOT OK)</div>
              <div>✓ Доступно без регистрации</div>
              <div>✓ Быстрая проверка (10-30 сек)</div>
              <div className="text-xs mt-3 pt-2 border-t">Отлично для быстрой оценки</div>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">Полный анализ (платный)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div>✓ Все ошибки с точными ссылками</div>
              <div>✓ Детальные рекомендации по исправлению</div>
              <div>✓ Автоматическое исправление</div>
              <div>✓ История всех проверок</div>
              <div>✓ Пакетная обработка описаний</div>
              <div className="text-xs mt-3 pt-2 border-t">Требует регистрации</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
