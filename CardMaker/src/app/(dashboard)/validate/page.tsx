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
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Проверка описания</h1>
          <p className="text-muted-foreground">
            Убедитесь, что карточка пройдёт модерацию маркетплейса
          </p>
        </div>

        {/* Badge */}
        <div className="mb-8">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
            Проходит требования Ozon / Wildberries
          </Badge>
        </div>

        {/* Main Form */}
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Описание товара</CardTitle>
            <CardDescription>
              Вставьте текст описания для проверки перед публикацией
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Textarea */}
            <div className="space-y-2">
              <Textarea
                placeholder="Вставьте описание товара, которое хотите проверить перед публикацией на маркетплейсе."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className={`resize-y min-h-[320px] font-mono text-sm ${
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

              {/* Validation Result */}
              {validation !== null && (
                <div className="mt-4 space-y-3">
                  {validation.isValid ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Проверка пройдена. Описание соответствует требованиям.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          Обнаружены нарушения требований маркетплейса
                        </span>
                      </div>

                      {/* Issues Card */}
                      <Card className="bg-red-50 border-red-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Найденные проблемы</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {validation.issues.map((issue, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                                <span className="text-red-500 font-bold mt-0.5">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>

                          {validation.bannedWordsFound.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-red-200">
                              <p className="text-xs font-medium text-red-700 mb-2">
                                Запрещённые слова в описании:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {validation.bannedWordsFound.map((word, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="bg-red-200 text-red-900"
                                  >
                                    {word}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Button */}
            <div className="flex gap-2">
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
              >
                {isDemoMode ? "Реальная проверка" : "Показать ошибку (demo)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            В платной версии вы можете сразу исправлять и подготавливать описания под маркетплейсы.
          </p>
        </div>
      </div>
    </div>
  )
}
