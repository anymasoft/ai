"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Mock данные для проверки
const BANNED_WORDS = [
  "уникальный",
  "инновационный",
  "революционный",
  "лучший",
  "гарантированно",
  "проверено",
  "только здесь",
  "выгода",
  "скидка до",
  "премиум качество",
  "класс люкс",
  "элитный",
  "экслюзивный",
  "супер",
  "мега",
]

const VALIDATION_RULES = [
  {
    id: "length",
    text: "Длина описания должна быть от 100 до 4000 символов",
    check: (text: string) => text.length >= 100 && text.length <= 4000,
  },
  {
    id: "banned_words",
    text: "Отсутствуют запрещённые слова и формулировки",
    check: (text: string) => {
      const lowerText = text.toLowerCase()
      return !BANNED_WORDS.some((word) => lowerText.includes(word.toLowerCase()))
    },
  },
  {
    id: "paragraphs",
    text: "Описание разбито на абзацы для лучшей читаемости",
    check: (text: string) => (text.match(/\n/g) || []).length >= 1,
  },
  {
    id: "specs",
    text: "Наличие основных характеристик товара",
    check: (text: string) => {
      const specs = ["размер", "вес", "материал", "цвет", "рост", "объём", "мощность", "тип", "модель"]
      return specs.some((spec) => text.toLowerCase().includes(spec))
    },
  },
  {
    id: "no_symbols",
    text: "Отсутствуют лишние символы и мусор",
    check: (text: string) => !/([@#$%^&*]{2,}|[^\w\s\n\.\,\-\:\;\(\)\—])/g.test(text),
  },
]

interface ValidationResult {
  isValid: boolean
  issues: string[]
  bannedWordsFound: string[]
}

function validateText(text: string): ValidationResult {
  const lowerText = text.toLowerCase()
  const issues: string[] = []
  const bannedWordsFound: string[] = []

  // Проверить каждое правило
  VALIDATION_RULES.forEach((rule) => {
    if (!rule.check(text)) {
      issues.push(rule.text)
    }
  })

  // Найти запрещённые слова
  BANNED_WORDS.forEach((word) => {
    if (lowerText.includes(word.toLowerCase())) {
      bannedWordsFound.push(word)
    }
  })

  return {
    isValid: issues.length === 0,
    issues,
    bannedWordsFound,
  }
}

export default function ValidatePage() {
  const [text, setText] = useState("")
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const handleValidate = () => {
    if (!text.trim()) {
      setValidation(null)
      return
    }

    if (isDemoMode) {
      // Демо режим: показать ошибку
      setValidation({
        isValid: false,
        issues: [
          "Используются запрещённые маркетинговые слова",
          "Длина описания меньше рекомендуемой (меньше 200 символов)",
          "Недостаточно информации о характеристиках товара",
        ],
        bannedWordsFound: ["уникальный", "лучший", "супер"],
      })
    } else {
      // Реальная валидация
      const result = validateText(text)
      setValidation(result)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header - как в card-generator */}
        <div className="text-center pt-2 mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Проверка описания</h1>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
            Проходит требования Ozon / Wildberries
          </Badge>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_minmax(320px,32%)] gap-4">
          {/* LEFT COLUMN - Input */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Описание товара</CardTitle>
              <CardDescription>
                Вставьте текст описания для проверки перед публикацией
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Textarea */}
              <Textarea
                placeholder="Вставьте описание товара, которое хотите проверить перед публикацией на маркетплейсе."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`resize-y min-h-[560px] font-mono text-sm ${
                  validation !== null
                    ? validation.isValid
                      ? "border-green-500 focus-visible:ring-green-500"
                      : "border-red-500 focus-visible:ring-red-500"
                    : ""
                } ${
                  validation?.bannedWordsFound && validation.bannedWordsFound.length > 0
                    ? "bg-red-50/30"
                    : ""
                }`}
              />

              {/* Button */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={handleValidate}
                  size="sm"
                  className="w-fit"
                >
                  Проверить
                </Button>

                {/* Demo Mode Toggle (dev only) */}
                <Button
                  onClick={() => setIsDemoMode(!isDemoMode)}
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  title="Переключитель для тестирования UI (dev only)"
                >
                  {isDemoMode ? "Реальная проверка" : "Demo: ошибка"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT COLUMN - Results */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Результаты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[calc(560px+100px)] overflow-y-auto">
              {/* Before validation - Placeholder */}
              {validation === null ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground text-sm">
                    Здесь появятся результаты проверки вашего описания
                  </div>
                </div>
              ) : validation.isValid ? (
                /* Success state */
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-700">Проверка пройдена</p>
                      <p className="text-xs text-green-600 mt-1">Описание соответствует требованиям маркетплейса</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Error state */
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Обнаружены нарушения</p>
                      <p className="text-xs text-red-600 mt-1">Требования маркетплейса не соблюдены</p>
                    </div>
                  </div>

                  {/* Issues */}
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-700">Проблемы:</p>
                    <ul className="space-y-1">
                      {validation.issues.map((issue, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-red-700">
                          <span className="font-bold mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Banned words */}
                  {validation.bannedWordsFound.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-red-700">Запрещённые слова:</p>
                      <div className="flex flex-wrap gap-1">
                        {validation.bannedWordsFound.map((word, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-red-200 text-red-900 text-xs"
                          >
                            {word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CTA - внизу, полная ширина */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            В платной версии вы можете сразу исправлять и подготавливать описания под маркетплейсы.
          </p>
        </div>
      </div>
    </div>
  )
}
