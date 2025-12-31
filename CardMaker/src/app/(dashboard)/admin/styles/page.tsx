"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Save, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StylePreset {
  id: string
  name: string
  label: string
  description: string
  defaultValue: string
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: "selling",
    name: "Продающий",
    label: "Продающий стиль",
    description: "Акцент на выгодах и преимуществах товара. Призыв к действию.",
    defaultValue: `Продающий стиль описания:

Задача: Создать описание, которое продаёт товар.

Характеристики:
- Акцент на выгодах для покупателя, а не на технических характеристиках
- Использовать эмоциональный язык и стоп-слова вроде "идеально", "премиум", "эксклюзивно"
- Короткие, ударные предложения
- Явный призыв к действию в конце
- Использовать списки (• или -) для наглядности

Примеры стоп-слов:
- Идеально для...
- Премиум качество
- Гарантированно
- Быстрая доставка
- Прямо сейчас
- Не упусти!`,
  },
  {
    id: "expert",
    name: "Экспертный",
    label: "Экспертный стиль",
    description: "Фокус на технических деталях и спецификациях. Авторитетный тон.",
    defaultValue: `Экспертный стиль описания:

Задача: Создать описание, которое вызывает доверие к товару через компетентность.

Характеристики:
- Подробное описание технических характеристик
- Сравнение с аналогами (если уместно)
- Объяснение преимуществ на языке специалиста
- Фокус на качестве материалов и сборке
- Авторитетный, информативный тон
- Ссылки на стандарты, сертификаты

Структура:
1. Что это и для кого
2. Ключевые технические характеристики
3. Материалы и качество сборки
4. Преимущества перед конкурентами
5. Гарантия и поддержка`,
  },
  {
    id: "brief",
    name: "Краткий",
    label: "Краткий стиль",
    description: "Минимум слов, максимум информации. Структурированно и ясно.",
    defaultValue: `Краткий стиль описания:

Задача: Создать краткое и ясное описание без воды.

Характеристики:
- Максимум информации в минимум текста
- Использовать маркированные списки
- Каждое предложение должно содержать смысл
- Без лишних эпитетов и описаний
- Чёткая структура
- Лаконичный язык

Структура (примерно):
Основная информация (1 строка)
• Характеристика 1
• Характеристика 2
• Характеристика 3
Для кого: [целевая аудитория]
Гарантия: [информация]`,
  },
]

export default function StylesPage() {
  const [styles, setStyles] = useState<Record<string, string>>(
    STYLE_PRESETS.reduce((acc, preset) => {
      acc[preset.id] = preset.defaultValue
      return acc
    }, {} as Record<string, string>)
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleStyleChange = (styleId: string, value: string) => {
    setStyles((prev) => ({
      ...prev,
      [styleId]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    // Имитация сохранения
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success("Стили сохранены")
      setTimeout(() => setSaved(false), 3000)
    }, 500)
  }

  const handleReset = (styleId: string) => {
    const preset = STYLE_PRESETS.find((p) => p.id === styleId)
    if (preset) {
      handleStyleChange(styleId, preset.defaultValue)
      toast.info(`Стиль "${preset.name}" восстановлен`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Стили описаний</h1>
        <p className="text-muted-foreground mt-1">
          Управляй инструкциями для каждого стиля. Они определяют, как система будет генерировать описания.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Изменения стилей применяются ко всем новым генерациям. Пользователи выбирают стиль при создании карточки.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="selling" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          {STYLE_PRESETS.map((preset) => (
            <TabsTrigger key={preset.id} value={preset.id}>
              {preset.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {STYLE_PRESETS.map((preset) => (
          <TabsContent key={preset.id} value={preset.id} className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{preset.label}</CardTitle>
                    <CardDescription>{preset.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{preset.name}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`style-${preset.id}`} className="text-base font-semibold">
                    Инструкция для AI (системный промпт)
                  </Label>
                  <Textarea
                    id={`style-${preset.id}`}
                    value={styles[preset.id]}
                    onChange={(e) => handleStyleChange(preset.id, e.target.value)}
                    className="min-h-96 resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Эта инструкция будет передана AI при создании описания в стиле "{preset.name}".
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleReset(preset.id)}
                  >
                    Восстановить по умолчанию
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saved ? "✓ Сохранено" : saving ? "Сохраняю..." : "Сохранить"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="bg-muted/50 border-dashed">
              <CardHeader>
                <CardTitle className="text-sm">Как пользователь видит этот стиль</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="font-medium mb-1">Название:</p>
                  <p className="text-muted-foreground">{preset.name}</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Описание:</p>
                  <p className="text-muted-foreground">{preset.description}</p>
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
            <strong>Будь конкретным:</strong> Опиши ровно то, как должно выглядеть описание в этом стиле.
          </p>
          <p>
            <strong>Приведи примеры:</strong> Показывай "до и после", примеры стоп-слов, структуру.
          </p>
          <p>
            <strong>Установи рамки:</strong> Длина текста, количество пунктов, эмоциональность.
          </p>
          <p>
            <strong>Проверь результат:</strong> После сохранения создай карточку в этом стиле и проверь качество.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
