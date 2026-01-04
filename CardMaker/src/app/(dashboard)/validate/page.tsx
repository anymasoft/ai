"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2, Copy } from "lucide-react"
import { toast } from "sonner"
import type { ValidationResult } from '@/lib/ai-services/validation'

type Marketplace = "ozon" | "wb"

const MARKETPLACE_NAMES: Record<Marketplace, string> = {
  ozon: "Ozon",
  wb: "Wildberries"
}

// Типы статусов валидации UI
type ValidationUIStatus = "fail" | "pass_with_warning" | "pass"

/**
 * Определить статус UI для результата валидации
 * - fail: есть критические ошибки (isValid === false)
 * - pass_with_warning: проходит проверку, но есть предупреждения
 * - pass: полностью соответствует требованиям
 */
function getValidationUIStatus(result: ValidationResult): ValidationUIStatus {
  if (!result.isValid) {
    return "fail"
  }

  // Есть ли нарушения (warnings)?
  const hasWarnings = result.issues && result.issues.length > 0
  return hasWarnings ? "pass_with_warning" : "pass"
}

export default function ValidatePage() {
  const [text, setText] = useState("")
  const [marketplace, setMarketplace] = useState<Marketplace>("ozon")
  const [isLoading, setIsLoading] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCorrectionSuccess, setShowCorrectionSuccess] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Prefill from landing page free check
  useEffect(() => {
    const prefill = localStorage.getItem("beem_validate_prefill")
    if (prefill) {
      try {
        const data = JSON.parse(prefill) as {
          marketplace: Marketplace
          text: string
          intent?: "details" | "fix"
        }
        if (data.text && data.marketplace) {
          setText(data.text)
          setMarketplace(data.marketplace)
          toast.success("Описание загружено из проверки")
        }
      } catch (e) {
        console.error("Failed to parse prefill data", e)
      }
      localStorage.removeItem("beem_validate_prefill")
    }
  }, [])

  const handleValidate = async () => {
    if (!text.trim()) {
      setValidation(null)
      setError(null)
      setShowCorrectionSuccess(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setValidation(null)
    setShowCorrectionSuccess(false)

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
    setShowCorrectionSuccess(false)

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
        const correctedText = result.data.corrected?.trim() || ""
        const originalText = text.trim()
        const hasRealChanges = correctedText !== originalText && result.data.changesCount > 0

        if (hasRealChanges) {
          // Действительно были изменения → применяем и показываем успех
          setText(correctedText)
          setValidation(null)
          setShowCorrectionSuccess(true)
        } else {
          // Нет изменений → показываем warning, но НЕ сбрасываем валидацию
          setError("Автоисправление не внесло изменений. Проверьте текст вручную или попробуйте ещё раз.")
        }
      } else {
        throw new Error("Неверный формат ответа от API")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyText = async () => {
    if (!text.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      toast.success("Текст скопирован")
    } catch (err) {
      toast.error("Не удалось скопировать текст")
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden gap-4 px-4">
      {/* Page Header */}
      <div className="pt-4">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Проверка описания</h1>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
            Проходит требования Ozon / Wildberries
          </Badge>
        </div>
      </div>

      {/* Workspace: 2-column layout with fixed heights */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] gap-4 pb-4 overflow-hidden">
        {/* LEFT COLUMN - Input */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4 flex-shrink-0">
            <div className="flex-1">
              <CardTitle className="text-lg">Описание товара</CardTitle>
              <CardDescription>
                Выберите маркетплейс и вставьте текст описания для проверки
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                onClick={handleValidate}
                disabled={isLoading || !text.trim()}
                size="sm"
                className="h-9"
              >
                {isLoading ? "Проверяется..." : "Проверить"}
              </Button>
              {validation && !validation.isValid && (
                <Button
                  onClick={handleCorrect}
                  disabled={isLoading}
                  size="sm"
                  className="h-9 bg-amber-600 hover:bg-amber-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    </>
                  ) : (
                    "Исправить"
                  )}
                </Button>
              )}
            </div>
          </CardHeader>

          {/* Marketplace selector */}
          <div className="px-6 pb-3 flex gap-2 border-b flex-shrink-0">
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

          {/* Input area - scrollable */}
          <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col">
            <div className="relative flex-1 flex flex-col p-4 bg-muted/20 border border-input rounded-lg overflow-hidden hover:border-neutral-400 transition-colors min-h-96">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyText}
                      disabled={!text.trim() || isLoading}
                      className="absolute top-4 right-4 p-2 rounded-md opacity-50 hover:opacity-100 hover:bg-muted transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Скопировать текст</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Textarea
                ref={textareaRef}
                placeholder="Вставьте описание товара, которое хотите проверить перед публикацией на маркетплейсе."
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setShowCorrectionSuccess(false)
                }}
                disabled={isLoading}
                className="flex-1 resize-none min-h-0 user-text bg-transparent border-0 outline-none focus-visible:ring-0 placeholder-muted-foreground disabled:opacity-50"
              />
            </div>
          </CardContent>
        </Card>

        {/* RIGHT COLUMN - Results */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-4 flex-shrink-0">
            <CardTitle className="text-lg">Результаты</CardTitle>
          </CardHeader>

          {/* Results content - scrollable */}
          <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
            {/* Success state - after correction */}
            {showCorrectionSuccess && !validation && !error && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Описание успешно исправлено</p>
                    <p className="text-xs text-green-600 mt-2">
                      Текст приведён в соответствие требованиями маркетплейса. Вы можете повторно нажать «Проверить» для финальной валидации.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Before validation - Placeholder */}
            {!validation && !error && !showCorrectionSuccess && (
              <div className="text-center text-muted-foreground text-sm py-6">
                Здесь появятся результаты проверки вашего описания
              </div>
            )}

            {/* Error state - network/server errors */}
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

            {/* Validation result UI - three states based on getValidationUIStatus() */}
            {validation && (
              <>
                {getValidationUIStatus(validation) === "fail" && (
                  <>
                    {/* FAIL: Critical errors found */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-base font-semibold text-red-700">Описание НЕ соответствует требованиям {MARKETPLACE_NAMES[validation.marketplace]}</p>
                          {validation.summary && (
                            <p className="text-sm text-red-600 mt-1">{validation.summary}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Issues list for FAIL */}
                    {validation.issues && validation.issues.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-semibold text-red-700">Нарушения:</p>
                        <ul className="space-y-1.5">
                          {validation.issues.map((issue, i) => (
                            <li key={i} className="text-sm">
                              <div className="flex items-start gap-2">
                                <span className="font-bold mt-0.5 flex-shrink-0">•</span>
                                <div className="flex-1">
                                  <p className="text-red-700 font-medium leading-snug">{issue.message}</p>
                                  {issue.suggestion && (
                                    <p className="text-red-600 text-sm mt-0.5 leading-snug">{issue.suggestion}</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {getValidationUIStatus(validation) === "pass_with_warning" && (
                  <>
                    {/* PASS + WARNING: Passes but has warnings */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-base font-semibold text-amber-700">Описание проходит модерацию, но есть замечания</p>
                          <p className="text-sm text-amber-600 mt-1">
                            Карточка, скорее всего, будет принята, но описание можно улучшить
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Issues list for PASS+WARNING */}
                    {validation.issues && validation.issues.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-semibold text-amber-700">Замечания:</p>
                        <ul className="space-y-1.5">
                          {validation.issues.map((issue, i) => (
                            <li key={i} className="text-sm">
                              <div className="flex items-start gap-2">
                                <span className="font-bold mt-0.5 flex-shrink-0">•</span>
                                <div className="flex-1">
                                  <p className="text-amber-700 font-medium leading-snug">{issue.message}</p>
                                  {issue.suggestion && (
                                    <p className="text-amber-600 text-sm mt-0.5 leading-snug">{issue.suggestion}</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {getValidationUIStatus(validation) === "pass" && (
                  <>
                    {/* PASS: Fully compliant, no issues */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-base font-semibold text-green-700">Описание соответствует требованиям {MARKETPLACE_NAMES[validation.marketplace]}</p>
                          {validation.summary && (
                            <p className="text-sm text-green-600 mt-1">{validation.summary}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* No issues list for PASS - intentionally empty */}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
