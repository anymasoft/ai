"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Category {
  id: string
  key: string
  title: string
  prompt: string
  is_active: number
  updated_at: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Загрузить категории при загрузке страницы
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/config/categories")

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка при загрузке категорий")
      }

      const data = await response.json()
      if (!data.categories || !Array.isArray(data.categories)) {
        throw new Error("Некорректный формат ответа от API")
      }

      setCategories(data.categories)
    } catch (error) {
      console.error("❌ Error loading categories:", error)
      const message = error instanceof Error ? error.message : "Не удалось загрузить категории"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (categoryKey: string, value: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.key === categoryKey ? { ...cat, prompt: value } : cat
      )
    )
  }

  const handleSave = async (categoryKey: string) => {
    const category = categories.find((c) => c.key === categoryKey)
    if (!category) return

    setSavingKey(categoryKey)
    try {
      const response = await fetch("/api/admin/config/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ key: category.key, prompt: category.prompt }],
        }),
      })

      if (!response.ok) throw new Error("Ошибка при сохранении")

      toast.success(`Категория "${category.title}" сохранена`)
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось сохранить категорию")
    } finally {
      setSavingKey(null)
    }
  }

  const handleClear = (categoryKey: string) => {
    handleCategoryChange(categoryKey, "")
    toast.info("Категория очищена")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка категорий...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Мини-промпты категорий</h1>
        <p className="text-muted-foreground mt-1">
          Управляй инструкциями для каждой категории товаров. Они уточняют, на какие характеристики акцентировать внимание при создании описаний.
        </p>
      </div>

      {categories.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Нет категорий в системе. Выполни миграцию БД.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Промпты категорий применяются к созданию описаний, когда пользователь выбирает соответствующую категорию. Если промпт пустой, блок будет пропущен.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-6">
            {categories.map((category) => (
              <Card key={category.key} className="border">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Ключ: <code className="bg-muted px-2 py-1 rounded">{category.key}</code>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Активна" : "Неактивна"}
                      </Badge>
                      <Button
                        onClick={() => handleSave(category.key)}
                        disabled={savingKey === category.key}
                        size="icon"
                        variant="outline"
                        title="Сохранить категорию"
                      >
                        {savingKey === category.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor={`category-${category.key}`}
                      className="text-base font-semibold"
                    >
                      Мини-промпт для AI
                    </Label>
                    <Textarea
                      id={`category-${category.key}`}
                      value={category.prompt}
                      onChange={(e) =>
                        handleCategoryChange(category.key, e.target.value)
                      }
                      placeholder={`Напиши инструкцию для AI как генерировать описания для категории "${category.title}". Например: "Акцент на технические характеристики и совместимость..."`}
                      className="min-h-32 resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Эта инструкция будет добавлена в блок "ИНСТРУКЦИИ ПО КАТЕГОРИИ" при создании описания для категории "{category.title}".
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClear(category.key)}
                    >
                      Очистить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Card */}
          <Card className="bg-muted/50 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Примеры мини-промптов по категориям</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Электроника:</strong>
                <p className="ml-4">Акцент на технические характеристики (модели чипов, версии протоколов, время автономности), совместимость с платформами, гарантию и сервис.</p>
              </div>
              <div>
                <strong className="text-foreground">Одежда:</strong>
                <p className="ml-4">Акцент на дизайн, цвет, материал, стиль жизни, как вещь смотрится, интеграцию в образ. Минимум технических спец.</p>
              </div>
              <div>
                <strong className="text-foreground">Спорт:</strong>
                <p className="ml-4">Акцент на надёжность, защиту, производительность в экстремальных условиях, спортивные функции, метрики тренировки.</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
