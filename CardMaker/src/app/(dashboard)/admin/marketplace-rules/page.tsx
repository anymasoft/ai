"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const DEFAULT_RULES = {
  ozon: `Правила и требования для Ozon:

1. Заголовок товара (до 100 символов):
   - НЕ использовать CAPS LOCK (кроме аббревиатур)
   - НЕ повторять слова
   - Включить главное слово (например, название товара)
   - Можно добавить размер/цвет в конце

2. Описание товара:
   - Запрещено обещать лечение
   - Запрещена чрезмерная эмоциональность
   - Требуется указание материала
   - Запрещены ссылки на сайты

3. Ключевые слова:
   - Максимум 5-7 ключевых слов
   - Разделены запятыми
   - Без точек в конце

4. Фото:
   - Минимум 3 фото
   - Качество не ниже 500x500px
   - На белом фоне`,
  wildberries: `Правила и требования для Wildberries:

1. Название товара (до 160 символов):
   - Можно использовать специальные символы (/, -, .)
   - Обязательно указать основное слово
   - Можно добавить модель/версию

2. Описание товара:
   - Максимум 3000 символов
   - Нужно описать материал, размеры, вес
   - Можно использовать маркированные списки
   - Запрещена реклама других сайтов

3. Артикул и штрихкод:
   - Штрихкод обязателен (EAN-13)
   - Артикул продавца (до 20 символов)

4. Характеристики:
   - Заполнить все обязательные поля
   - Цвет, размер, материал обязательны
   - Не использовать "Нет" или "Не указано"

5. Фото:
   - Минимум 2 фото, рекомендуется 5+
   - Размер от 500x500px
   - Первое фото - главное (без текста)`,
}

export default function MarketplaceRulesPage() {
  const [ozonRules, setOzonRules] = useState(DEFAULT_RULES.ozon)
  const [wbRules, setWbRules] = useState(DEFAULT_RULES.wildberries)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Имитация сохранения
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success("Правила сохранены")
      setTimeout(() => setSaved(false), 3000)
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Правила маркетплейсов</h1>
        <p className="text-muted-foreground mt-1">
          Управляй требованиями для каждого маркетплейса. Эти правила будут учитываться при генерации карточек.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Изменения правил будут применены при следующей генерации карточек. Уже созданные карточки не изменяются.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="ozon" className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="ozon">Ozon</TabsTrigger>
          <TabsTrigger value="wildberries">Wildberries</TabsTrigger>
        </TabsList>

        {/* Ozon Tab */}
        <TabsContent value="ozon" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Правила Ozon</CardTitle>
                  <CardDescription>
                    Требования для заголовков, описаний и других полей карточки
                  </CardDescription>
                </div>
                <Badge>Основной</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ozon-rules" className="text-base font-semibold">
                  Правила и требования
                </Label>
                <Textarea
                  id="ozon-rules"
                  value={ozonRules}
                  onChange={(e) => setOzonRules(e.target.value)}
                  className="min-h-96 resize-none font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Используй форматирование текста для удобства. Все требования будут показаны в интерфейсе при создании карточки.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOzonRules(DEFAULT_RULES.ozon)}>
                  Восстановить по умолчанию
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saved ? "✓ Сохранено" : saving ? "Сохраняю..." : "Сохранить"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wildberries Tab */}
        <TabsContent value="wildberries" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Правила Wildberries</CardTitle>
                  <CardDescription>
                    Требования для заголовков, описаний и других полей карточки
                  </CardDescription>
                </div>
                <Badge variant="secondary">Вторичный</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wb-rules" className="text-base font-semibold">
                  Правила и требования
                </Label>
                <Textarea
                  id="wb-rules"
                  value={wbRules}
                  onChange={(e) => setWbRules(e.target.value)}
                  className="min-h-96 resize-none font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Используй форматирование текста для удобства. Все требования будут показаны в интерфейсе при создании карточки.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setWbRules(DEFAULT_RULES.wildberries)}>
                  Восстановить по умолчанию
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saved ? "✓ Сохранено" : saving ? "Сохраняю..." : "Сохранить"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Как это работает</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>1. Редактирование:</strong> Редактируй требования для каждого маркетплейса в отдельных вкладках.
          </p>
          <p>
            <strong>2. Сохранение:</strong> Нажми "Сохранить" чтобы применить изменения.
          </p>
          <p>
            <strong>3. Применение:</strong> При следующей генерации карточки система будет учитывать эти правила.
          </p>
          <p>
            <strong>4. Восстановление:</strong> Нажми "Восстановить по умолчанию" чтобы вернуть исходные требования.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
