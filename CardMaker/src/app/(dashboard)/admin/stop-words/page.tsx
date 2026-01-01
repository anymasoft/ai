"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StopWord {
  id: string
  marketplace: string | null
  category: string
  words: string
  is_active: number
  name?: string
  label?: string
  description?: string
}

const CATEGORY_INFO: Record<string, { name: string; label: string; description: string }> = {
  marketing: {
    name: "Маркетинговые слова",
    label: "Запрещённые маркетинговые слова",
    description: "Слова с преувеличением и броскими утверждениями, которые маркетплейсы не одобряют",
  },
  health: {
    name: "Запрещённые обещания",
    label: "Медицинские и здоровье обещания",
    description: "Слова, обещающие медицинский эффект, излечение или улучшение здоровья",
  },
  prohibited: {
    name: "Общие запреты",
    label: "Общие запрещённые слова",
    description: "Слова, которые маркетплейсы запрещают в описаниях категорически",
  },
  custom: {
    name: "Пользовательский список",
    label: "Кастомные стоп-слова",
    description: "Добавь сюда свои слова, которые не должны быть в описаниях",
  },
}

export default function StopWordsPage() {
  const [stopWords, setStopWords] = useState<StopWord[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Загрузить данные из API при монтировании
  useEffect(() => {
    const fetchStopWords = async () => {
      try {
        const response = await fetch("/api/admin/config/stop-words")
        if (response.ok) {
          const data = await response.json()
          // Добавить UI информацию к каждому стоп-слову
          const enriched = data.stopWords.map((sw: any) => ({
            ...sw,
            name: CATEGORY_INFO[sw.category]?.name || sw.category,
            label: CATEGORY_INFO[sw.category]?.label || sw.category,
            description: CATEGORY_INFO[sw.category]?.description || "",
          }))
          setStopWords(enriched)
        } else {
          toast.error("Ошибка при загрузке стоп-слов")
        }
      } catch (error) {
        console.error("Failed to fetch stop words:", error)
        toast.error("Не удалось загрузить стоп-слова")
      } finally {
        setLoading(false)
      }
    }

    fetchStopWords()
  }, [])

  const handleStopWordsChange = (id: string, value: string) => {
    setStopWords((prev) =>
      prev.map((sw) => (sw.id === id ? { ...sw, words: value } : sw))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Отправить все стоп-слова на сервер
      const response = await fetch("/api/admin/config/stop-words", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stopWords: stopWords.map((sw) => ({
            id: sw.id,
            marketplace: sw.marketplace,
            category: sw.category,
            words: sw.words,
          })),
        }),
      })
      if (response.ok) {
        setSaved(true)
        toast.success("Стоп-слова сохранены")
        setTimeout(() => setSaved(false), 3000)
      } else {
        toast.error("Ошибка при сохранении стоп-слов")
      }
    } catch (error) {
      console.error("Error saving stop words:", error)
      toast.error("Ошибка при сохранении стоп-слов")
    } finally {
      setSaving(false)
    }
  }

  const getWordCount = (text: string): number => {
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .length
  }

  // Отфильтровать стоп-слова с известными категориями (без marketplace)
  const categoriedStopWords = stopWords.filter(
    (sw) => !sw.marketplace && CATEGORY_INFO[sw.category]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Стоп-слова</h1>
        <p className="text-muted-foreground mt-1">
          Управляй списками слов, которые НЕ должны появляться в описаниях товаров. Эти слова будут проверяться при валидации.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Слова должны быть записаны по одному на строку. При проверке описания система будет искать эти слова (с учётом морфологии и регистра).
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : (
        <Tabs defaultValue={categoriedStopWords[0]?.category || "marketing"} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            {categoriedStopWords.map((sw) => (
              <TabsTrigger key={sw.id} value={sw.category}>
                {sw.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {categoriedStopWords.map((sw) => (
            <TabsContent key={sw.id} value={sw.category} className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{sw.label}</CardTitle>
                      <CardDescription>{sw.description}</CardDescription>
                    </div>
                    <Badge variant="outline">{getWordCount(sw.words)} слов</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`stopwords-${sw.id}`} className="text-base font-semibold">
                      Список стоп-слов
                    </Label>
                    <Textarea
                      id={`stopwords-${sw.id}`}
                      value={sw.words}
                      onChange={(e) => handleStopWordsChange(sw.id, e.target.value)}
                      placeholder="Введи слова по одному на строку..."
                      className="min-h-64 resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      По одному слову на строку. Пробелы в начале и конце строк будут автоматически удалены.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saved ? "✓ Сохранено" : saving ? "Сохраняю..." : "Сохранить"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              {getWordCount(sw.words) > 0 && (
                <Card className="bg-muted/50 border-dashed">
                  <CardHeader>
                    <CardTitle className="text-sm">Предпросмотр слов</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {sw.words
                        .split("\n")
                        .filter((word) => word.trim().length > 0)
                        .map((word, index) => (
                          <Badge key={index} variant="secondary" className="font-mono text-xs">
                            {word.trim()}
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Как использовать стоп-слова</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>1. Организация:</strong> Слова разделены по категориям для удобства управления.
          </p>
          <p>
            <strong>2. Формат:</strong> Каждое слово на отдельной строке. Система автоматически удалит пробелы.
          </p>
          <p>
            <strong>3. Сохранение:</strong> После редактирования нажми "Сохранить" чтобы применить изменения.
          </p>
          <p>
            <strong>4. Проверка:</strong> При валидации описания система проверит наличие этих слов в тексте.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
