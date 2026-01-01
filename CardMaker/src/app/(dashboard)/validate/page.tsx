"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2 } from "lucide-react"

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

// Mock ошибки для demo режима
const DEMO_ERROR_RESULT: ValidationResult = {
  isValid: false,
  issues: [
    "Используются запрещённые маркетинговые слова",
    "Недостаточно информации о характеристиках товара",
    "Описание может быть более подробным",
  ],
  bannedWordsFound: ["уникальный", "лучший"],
}

const DEMO_OK_RESULT: ValidationResult = {
  isValid: true,
  issues: [],
  bannedWordsFound: [],
}

export default function ValidatePage() {
  const [text, setText] = useState("")
  const [demoMode, setDemoMode] = useState<"ok" | "error">("ok")
  const [ran, setRan] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleValidate = () => {
    if (!text.trim()) {
      setRan(false)
      setValidation(null)
      return
    }

    setRan(true)

    // Используй demoMode для определения результата
    if (demoMode === "error") {
      setValidation(DEMO_ERROR_RESULT)
    } else {
      // demoMode === "ok"
      const result = validateText(text)
      setValidation(result)
    }
  }

  // Извлечение первого слова для подсветки
  const getFirstWord = () => {
    const words = text.trim().split(/\s+/)
    return words[0] || ""
  }

  const firstWord = getFirstWord()
  const shouldHighlightFirstWord = ran && demoMode === "error" && firstWord

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

        {/* Two-column layout with equal heights */}
        <div className="grid grid-cols-[1fr_minmax(320px,32%)] gap-4 h-[70vh] min-h-[560px]">
          {/* LEFT COLUMN - Input */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
              <div className="flex-1">
                <CardTitle className="text-lg">Описание товара</CardTitle>
                <CardDescription>
                  Вставьте текст описания для проверки перед публикацией
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={handleValidate}
                  size="sm"
                  className="h-9"
                >
                  Проверить
                </Button>
              </div>
            </CardHeader>

            {/* Demo mode selector in header */}
            <div className="px-6 pb-3 flex gap-2 border-b text-xs">
              <button
                onClick={() => setDemoMode("ok")}
                className={`px-2 py-1 rounded transition ${
                  demoMode === "ok"
                    ? "bg-green-100 text-green-700 font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Demo: Норма
              </button>
              <button
                onClick={() => setDemoMode("error")}
                className={`px-2 py-1 rounded transition ${
                  demoMode === "error"
                    ? "bg-red-100 text-red-700 font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Demo: Ошибка
              </button>
            </div>

            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              {/* Input area - визуальный контейнер */}
              <div className="flex-1 flex flex-col p-4 bg-muted/20 border border-input rounded-lg m-4 overflow-hidden hover:border-neutral-400 transition-colors">
                {/* Highlight overlay for first word */}
                {shouldHighlightFirstWord && (
                  <div
                    className="absolute top-0 left-0 right-0 p-4 font-mono text-sm leading-relaxed pointer-events-none overflow-hidden"
                    style={{
                      fontFamily: "inherit",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      width: textareaRef.current?.offsetWidth,
                      height: textareaRef.current?.offsetHeight,
                    }}
                  >
                    <mark className="bg-rose-100 text-rose-900 rounded px-1">{firstWord}</mark>
                    {text.length > firstWord.length && text[firstWord.length]}
                  </div>
                )}

                {/* Textarea */}
                <Textarea
                  ref={textareaRef}
                  placeholder="Вставьте описание товара, которое хотите проверить перед публикацией на маркетплейсе."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={`flex-1 resize-none min-h-0 font-mono text-sm bg-transparent border-0 outline-none focus-visible:ring-0 ${
                    ran && demoMode === "error"
                      ? "placeholder-red-400"
                      : "placeholder-muted-foreground"
                  } ${shouldHighlightFirstWord ? "bg-transparent" : ""}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* RIGHT COLUMN - Results */}
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Результаты</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {/* Before validation - Placeholder */}
              {!ran ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="text-muted-foreground text-sm">
                    Здесь появятся результаты проверки вашего описания
                  </div>
                </div>
              ) : demoMode === "ok" ? (
                /* Success state - ЗЕЛЁНЫЙ РЕЖИМ (demo) */
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-700">Проверка пройдена</p>
                        <p className="text-xs text-green-600 mt-1">Описание соответствует требованиям маркетплейса</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-4">
                    <div className="text-3xl font-bold text-green-700">100%</div>
                    <p className="text-xs text-muted-foreground mt-1">Качество описания</p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-2">Статус:</p>
                    <p className="text-xs text-green-700">✓ Нарушений не найдено</p>
                  </div>
                </div>
              ) : (
                /* Error state - КРАСНЫЙ РЕЖИМ (demo) */
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Обнаружены нарушения</p>
                        <p className="text-xs text-red-600 mt-1">Требования маркетплейса не соблюдены</p>
                      </div>
                    </div>
                  </div>

                  {/* Quality score */}
                  <div className="text-center py-3">
                    <div className="text-2xl font-bold text-red-700">62%</div>
                    <p className="text-xs text-muted-foreground mt-1">Качество описания</p>
                  </div>

                  {/* Issues */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-700">Проблемы:</p>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2 text-xs text-red-700">
                        <span className="font-bold mt-0.5 flex-shrink-0">•</span>
                        <span>Используются запрещённые маркетинговые слова</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-red-700">
                        <span className="font-bold mt-0.5 flex-shrink-0">•</span>
                        <span>Недостаточно информации о характеристиках товара</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-red-700">
                        <span className="font-bold mt-0.5 flex-shrink-0">•</span>
                        <span>Описание может быть более подробным</span>
                      </li>
                    </ul>
                  </div>

                  {/* Banned words */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-700">Запрещённые слова:</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="secondary"
                        className="bg-red-200 text-red-900 text-xs py-0.5"
                      >
                        уникальный
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-red-200 text-red-900 text-xs py-0.5"
                      >
                        лучший
                      </Badge>
                    </div>
                  </div>
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
