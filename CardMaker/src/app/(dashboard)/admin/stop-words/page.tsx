"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StopWordsEntry {
  id: string
  marketplace?: string
  category: string
  words: string
  is_active: number
}

export default function StopWordsPage() {
  const [stopWords, setStopWords] = useState<StopWordsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Загрузить стоп-слова при загрузке страницы
  useEffect(() => {
    loadStopWords()
  }, [])

  const loadStopWords = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/config/stop-words")
      if (!response.ok) throw new Error("Ошибка при загрузке стоп-слов")

      const data = await response.json()
      setStopWords(data.stopWords || [])
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось загрузить стоп-слова")
    } finally {
      setLoading(false)
    }
  }

  const handleWordsChange = (id: string, value: string) => {
    setStopWords((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, words: value } : item
      )
    )
  }

  const handleSave = async (id: string) => {
    const entry = stopWords.find((item) => item.id === id)
    if (!entry) return

    setSaving(true)
    try {
      const response = await fetch("/api/admin/config/stop-words", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stopWords: [
            {
              id: entry.id,
              marketplace: entry.marketplace || null,
              category: entry.category,
              words: entry.words,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error("Ошибка при сохранении")

      setSavedId(id)
      toast.success(`Стоп-слова "${entry.category}" сохранены`)
      setTimeout(() => setSavedId(null), 2000)
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось сохранить стоп-слова")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = (id: string) => {
    handleWordsChange(id, "")
    toast.info("Стоп-слова очищены")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка стоп-слов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Стоп-слова</h1>
        <p className="text-muted-foreground mt-1">
          Управляй списками запрещённых слов. Эти слова не будут использоваться при генерации описаний.
        </p>
      </div>

      {stopWords.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Нет стоп-слов в системе. Добавь списки через программу или создай их вручную.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Стоп-слова применяются при валидации и генерации описаний. Список должен содержать слова, разделённые переносом строки (каждое слово на отдельной строке).
            </AlertDescription>
          </Alert>

          <Tabs defaultValue={stopWords[0]?.id || ""} className="w-full">
            <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {stopWords.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="text-xs">
                  {item.category}
                </TabsTrigger>
              ))}
            </TabsList>

            {stopWords.map((item) => (
              <TabsContent key={item.id} value={item.id} className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{item.category}</CardTitle>
                        <CardDescription>
                          {item.marketplace ? `Для маркетплейса: ${item.marketplace}` : "Общие стоп-слова для всех маркетплейсов"}
                        </CardDescription>
                      </div>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Активны" : "Неактивны"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor={`words-${item.id}`}
                        className="text-base font-semibold"
                      >
                        Слова (по одному на строку)
                      </Label>
                      <Textarea
                        id={`words-${item.id}`}
                        value={item.words}
                        onChange={(e) =>
                          handleWordsChange(item.id, e.target.value)
                        }
                        placeholder="Введи запрещённые слова, по одному на строку..."
                        className="min-h-96 resize-none font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Каждое слово должно быть на отдельной строке. Система будет игнорировать эти слова при генерации описаний.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleClear(item.id)}
                      >
                        Очистить
                      </Button>
                      <Button
                        onClick={() => handleSave(item.id)}
                        disabled={saving}
                      >
                        {savedId === item.id
                          ? "✓ Сохранено"
                          : saving
                            ? "Сохраняю..."
                            : "Сохранить"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Info Card */}
          <Card className="bg-muted/50 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Когда использовать стоп-слова</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Маркетинговые запреты:</strong> Слова с преувеличением,
                которые маркетплейсы не одобряют (уникальный, лучший, мега и
                т.д.).
              </p>
              <p>
                <strong>Здоровье и медицина:</strong> Запрещённые обещания
                эффекта (лечит, исцеляет, помогает похудеть).
              </p>
              <p>
                <strong>Ссылки и контакты:</strong> Слова типа "сайт", "звоните"
                которые маркетплейсы запрещают.
              </p>
              <p>
                <strong>Специфичные для маркетплейса:</strong> Разные правила на
                Ozon, Wildberries и других платформах.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
