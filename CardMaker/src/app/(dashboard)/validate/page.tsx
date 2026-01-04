"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import type { ValidationResult } from '@/lib/ai-services/validation'

type Marketplace = "ozon" | "wb"

const MARKETPLACE_NAMES: Record<Marketplace, string> = {
  ozon: "Ozon",
  wb: "Wildberries"
}

export default function ValidatePage() {
  const [text, setText] = useState("")
  const [marketplace, setMarketplace] = useState<Marketplace>("ozon")
  const [isLoading, setIsLoading] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleValidate = async () => {
    if (!text.trim()) {
      setValidation(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    setValidation(null)

    try {
      const response = await fetch("/api/validate-text", {
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
        setValidation(result.data)
      } else {
        throw new Error("Неверный формат ответа от API")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCorrect = async () => {
    if (!text.trim() || !validation) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/correct-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          marketplace,
          issues: validation.issues,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка при исправлении текста")
      }

      const result = await response.json()
      if (result.success && result.data) {
        // Применяем исправления сразу в textarea
        setText(result.data.corrected)
        // Сбрасываем валидацию
        setValidation(null)
      } else {
        throw new Error("Неверный формат ответа от API")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main content */}
      <div className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-3">Проверка описания</h1>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
              Проходит требования Ozon / Wildberries
            </Badge>
          </div>

          {/* Two-column layout - normal flow, no fixed heights */}
          <div className="grid grid-cols-[1fr_minmax(320px,32%)] gap-4 auto-rows-max">
            {/* LEFT COLUMN - Input */}
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                <div className="flex-1">
                  <CardTitle className="text-lg">Описание товара</CardTitle>
                  <CardDescription>
                    Выберите маркетплейс и вставьте текст описания для проверки
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={handleValidate}
                    disabled={isLoading || !text.trim()}
                    size="sm"
                    className="h-9"
                  >
                    {isLoading ? "Проверяется..." : "Проверить"}
                  </Button>
                </div>
              </CardHeader>

              {/* Marketplace selector */}
              <div className="px-6 pb-3 flex gap-2 border-b">
                <label className="text-xs font-medium py-1">Маркетплейс:</label>
                <div className="flex gap-1 bg-muted p-0.5 rounded-md w-fit">
                  {[
                    { value: "ozon" as const, label: "Ozon" },
                    { value: "wb" as const, label: "Wildberries" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMarketplace(opt.value)}
                      disabled={isLoading}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50 ${
                        marketplace === opt.value
                          ? "bg-background shadow-sm border border-primary/20"
                          : "hover:text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input area */}
              <CardContent className="p-4 flex flex-col" style={{ minHeight: "300px" }}>
                <div className="flex-1 flex flex-col p-4 bg-muted/20 border border-input rounded-lg overflow-hidden hover:border-neutral-400 transition-colors">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Вставьте описание товара, которое хотите проверить перед публикацией на маркетплейсе."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 resize-none min-h-0 font-mono text-sm bg-transparent border-0 outline-none focus-visible:ring-0 placeholder-muted-foreground disabled:opacity-50"
                  />
                </div>
              </CardContent>
            </Card>

            {/* RIGHT COLUMN - Results */}
            <Card className="flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Результаты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Before validation - Placeholder */}
                {!validation && !error && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    Здесь появятся результаты проверки вашего описания
                  </div>
                )}

                {/* Error state */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Ошибка при проверке</p>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success state */}
                {validation && validation.isValid && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-700">✅ Описание соответствует требованиям {MARKETPLACE_NAMES[marketplace]}</p>
                        {validation.summary && (
                          <p className="text-xs text-green-600 mt-1">{validation.summary}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Failure state */}
                {validation && !validation.isValid && (
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">❌ Описание НЕ соответствует требованиям {MARKETPLACE_NAMES[marketplace]}</p>
                          {validation.summary && (
                            <p className="text-xs text-red-600 mt-1">{validation.summary}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Issues list */}
                    {validation.issues && validation.issues.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                        <p className="text-xs font-semibold text-red-700 sticky top-0 bg-red-50 pb-2">Нарушения:</p>
                        <ul className="space-y-1.5">
                          {validation.issues.map((issue, i) => (
                            <li key={i} className="text-xs">
                              <div className="flex items-start gap-2">
                                <span className="font-bold mt-0.5 flex-shrink-0">•</span>
                                <div className="flex-1">
                                  <p className="text-red-700 font-medium">{issue.message}</p>
                                  {issue.suggestion && (
                                    <p className="text-red-600 text-xs mt-0.5">💡 {issue.suggestion}</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Correction button */}
                    <Button
                      onClick={handleCorrect}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Исправляется...
                        </>
                      ) : (
                        "Исправить автоматически"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
