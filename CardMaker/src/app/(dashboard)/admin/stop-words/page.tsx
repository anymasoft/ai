"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { AlertCircle, Loader2, Plus, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StopWordsEntry {
  id: string
  marketplace?: string | null
  category: string
  words: string
  is_active: number
}

interface CreateForm {
  marketplace: string
  category: string
  words: string
}

export default function StopWordsPage() {
  const [stopWords, setStopWords] = useState<StopWordsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>({
    marketplace: "",
    category: "",
    words: "",
  })

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!createForm.category.trim()) {
      toast.error("Укажи категорию")
      return
    }

    const newId = `sw_${Date.now()}`
    setCreatingNew(true)

    try {
      const response = await fetch("/api/admin/config/stop-words", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stopWords: [
            {
              id: newId,
              marketplace: createForm.marketplace || null,
              category: createForm.category,
              words: createForm.words,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error("Ошибка при создании")

      toast.success(`Новые стоп-слова "${createForm.category}" созданы`)

      // Очистить форму и перезагрузить список
      setCreateForm({ marketplace: "", category: "", words: "" })
      await loadStopWords()
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось создать стоп-слова")
    } finally {
      setCreatingNew(false)
    }
  }

  const handleDeleteSubmit = async (id: string) => {
    // Удаление путём очистки и сохранения как пустая запись
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
              words: "", // Очищаем слова
            },
          ],
        }),
      })

      if (!response.ok) throw new Error("Ошибка при удалении")

      // Удалить из локального состояния
      setStopWords((prev) => prev.filter((item) => item.id !== id))
      toast.success("Стоп-слова удалены")
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось удалить стоп-слова")
    } finally {
      setSaving(false)
    }
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

      {/* Форма создания новых стоп-слов */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Добавить новые стоп-слова
          </CardTitle>
          <CardDescription>
            Создай новый список запрещённых слов для маркетплейса или общего использования
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-marketplace">Маркетплейс (опционально)</Label>
                <Select value={createForm.marketplace} onValueChange={(value) => setCreateForm({ ...createForm, marketplace: value })}>
                  <SelectTrigger id="new-marketplace">
                    <SelectValue placeholder="Выбери маркетплейс или оставь пусто" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Общие (для всех)</SelectItem>
                    <SelectItem value="ozon">Ozon</SelectItem>
                    <SelectItem value="wildberries">Wildberries</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-category">Категория *</Label>
                <Input
                  id="new-category"
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  placeholder="Например: маркетинговые, здоровье, запреты"
                  disabled={creatingNew}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-words">Слова (по одному на строку)</Label>
              <Textarea
                id="new-words"
                value={createForm.words}
                onChange={(e) => setCreateForm({ ...createForm, words: e.target.value })}
                placeholder="Введи запрещённые слова, по одному на строку..."
                className="min-h-64 resize-none font-mono text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={creatingNew || !createForm.category.trim()}
              className="w-full md:w-auto"
            >
              {creatingNew ? "Создаю..." : "Создать"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Список существующих стоп-слов */}
      {stopWords.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Нет стоп-слов в системе. Добавь новые выше.
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

          <div className="space-y-4">
            {stopWords.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.category}</CardTitle>
                      <CardDescription>
                        {item.marketplace
                          ? `Для маркетплейса: ${item.marketplace}`
                          : "Общие стоп-слова для всех маркетплейсов"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Активны" : "Неактивны"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSubmit(item.id)}
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`words-${item.id}`} className="text-base font-semibold">
                      Слова (по одному на строку)
                    </Label>
                    <Textarea
                      id={`words-${item.id}`}
                      value={item.words}
                      onChange={(e) => handleWordsChange(item.id, e.target.value)}
                      placeholder="Введи запрещённые слова, по одному на строку..."
                      className="min-h-96 resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Каждое слово должно быть на отдельной строке. Система будет игнорировать эти слова при генерации описаний.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => handleClear(item.id)} disabled={saving}>
                      Очистить
                    </Button>
                    <Button onClick={() => handleSave(item.id)} disabled={saving}>
                      {savedId === item.id
                        ? "✓ Сохранено"
                        : saving
                          ? "Сохраняю..."
                          : "Сохранить"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Card */}
          <Card className="bg-muted/50 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Когда использовать стоп-слова</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Маркетинговые запреты:</strong> Слова с преувеличением,
                которые маркетплейсы не одобряют.
              </p>
              <p>
                <strong>Здоровье и медицина:</strong> Запрещённые обещания
                эффекта.
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
