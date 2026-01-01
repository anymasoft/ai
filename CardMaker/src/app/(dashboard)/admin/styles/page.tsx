"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Save, AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Style {
  id: string
  key: string
  title: string
  prompt: string
  is_active: number
}

export default function StylesPage() {
  const [styles, setStyles] = useState<Style[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [currentTab, setCurrentTab] = useState<string>("")

  // Загрузить стили при загрузке страницы
  useEffect(() => {
    loadStyles()
  }, [])

  const loadStyles = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/config/styles")
      if (!response.ok) throw new Error("Ошибка при загрузке стилей")

      const data = await response.json()
      const stylesList = data.styles || []
      setStyles(stylesList)

      // Установить первый стиль как активную вкладку
      if (stylesList.length > 0 && !currentTab) {
        setCurrentTab(stylesList[0].key)
      }
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось загрузить стили")
    } finally {
      setLoading(false)
    }
  }

  const handleStyleChange = (styleKey: string, value: string) => {
    setStyles((prev) =>
      prev.map((style) =>
        style.key === styleKey ? { ...style, prompt: value } : style
      )
    )
  }

  const handleSave = async (styleKey: string) => {
    const style = styles.find((s) => s.key === styleKey)
    if (!style) return

    setSaving(true)
    try {
      const response = await fetch("/api/admin/config/styles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styles: [{ key: style.key, prompt: style.prompt }],
        }),
      })

      if (!response.ok) throw new Error("Ошибка при сохранении")

      setSavedId(styleKey)
      toast.success(`Стиль "${style.title}" сохранён`)
      setTimeout(() => setSavedId(null), 2000)
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось сохранить стиль")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = (styleKey: string) => {
    handleStyleChange(styleKey, "")
    toast.info("Стиль очищен")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка стилей...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Стили описаний</h1>
        <p className="text-muted-foreground mt-1">
          Управляй инструкциями для каждого стиля. Они определяют, как система будет генерировать описания.
        </p>
      </div>

      {styles.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Нет стилей в системе. Добавь стили через программу или создай их вручную.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Изменения стилей применяются ко всем новым генерациям. Пользователи выбирают стиль при создании карточки.
            </AlertDescription>
          </Alert>

          <Tabs
            value={currentTab}
            onValueChange={setCurrentTab}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              {styles.map((style) => (
                <TabsTrigger key={style.key} value={style.key}>
                  {style.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {styles.map((style) => (
              <TabsContent
                key={style.key}
                value={style.key}
                className="space-y-4 mt-4"
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{style.title}</CardTitle>
                        <CardDescription>
                          Редактируй инструкцию для этого стиля
                        </CardDescription>
                      </div>
                      <Badge variant={style.is_active ? "default" : "secondary"}>
                        {style.is_active ? "Активен" : "Неактивен"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor={`style-${style.key}`}
                        className="text-base font-semibold"
                      >
                        Инструкция для AI (системный промпт)
                      </Label>
                      <Textarea
                        id={`style-${style.key}`}
                        value={style.prompt}
                        onChange={(e) =>
                          handleStyleChange(style.key, e.target.value)
                        }
                        placeholder="Введи инструкцию для AI как генерировать описания в этом стиле"
                        className="min-h-96 resize-none font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Эта инструкция будет передана AI при создании описания
                        в стиле "{style.title}".
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleClear(style.key)}
                      >
                        Очистить
                      </Button>
                      <Button
                        onClick={() => handleSave(style.key)}
                        disabled={saving}
                      >
                        {savedId === style.key
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
              <CardTitle className="text-base">Как создавать хорошие инструкции</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Будь конкретным:</strong> Опиши ровно то, как должно
                выглядеть описание в этом стиле.
              </p>
              <p>
                <strong>Приведи примеры:</strong> Показывай "до и после",
                примеры стоп-слов, структуру.
              </p>
              <p>
                <strong>Установи рамки:</strong> Длина текста, количество
                пунктов, эмоциональность.
              </p>
              <p>
                <strong>Проверь результат:</strong> После сохранения создай
                карточку в этом стиле и проверь качество.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
