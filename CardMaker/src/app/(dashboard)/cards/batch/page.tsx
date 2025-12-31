"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, AlertTriangle, Sparkles } from "lucide-react"
import { toast } from "sonner"

export default function BatchGenerationPage() {
  const [listInput, setListInput] = useState("")
  const [fileInput, setFileInput] = useState<File | null>(null)

  const handleGenerateBatch = () => {
    toast.info("Функция массовой генерации будет доступна в Premium версии")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.name.endsWith(".csv") || file.name.endsWith(".xlsx")) {
        setFileInput(file)
        toast.info(`Файл ${file.name} выбран (функция скоро будет доступна)`)
      } else {
        toast.error("Загружай только CSV или XLSX файлы")
      }
    }
  }

  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Заголовок */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Массовая генерация карточек</h1>
        <p className="text-muted-foreground">Сгенерируйте сразу несколько карточек из списка или файла</p>
      </div>

      {/* Premium badge */}
      <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertDescription className="text-yellow-800 dark:text-yellow-300">
          <strong>Premium функция.</strong> Функция доступна только в Premium тарифах (Basic и выше).
          <a href="/settings/billing" className="underline ml-1 font-medium">Обновить тариф</a>
        </AlertDescription>
      </Alert>

      {/* Основной интерфейс */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="list">Вставить список</TabsTrigger>
          <TabsTrigger value="file">Загрузить файл</TabsTrigger>
        </TabsList>

        {/* Tab 1: Вставить список */}
        <TabsContent value="list" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Список товаров</CardTitle>
              <CardDescription>Введи описания товаров, разделённые пустой строкой или '---'</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`Товар 1: Умные часы с GPS. Bluetooth 5.3, водонепроницаемость IP67, 30 часов батареи.
---
Товар 2: Беспроводные наушники. Active Noise Cancellation, 40 часов работы, Bluetooth 5.3.
---
Товар 3: Спортивный рюкзак. Объём 30л, влагозащита, множество карманов.`}
                value={listInput}
                onChange={(e) => setListInput(e.target.value)}
                className="min-h-64 resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Разделяй товары пустой строкой или текстом '---' на отдельной строке.
              </p>
            </CardContent>
          </Card>

          {/* Preview */}
          {listInput && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Предпросмотр (как это будет выглядеть)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {listInput
                    .split(/\n---\n|\n\n/)
                    .filter((item) => item.trim())
                    .slice(0, 3)
                    .map((item, idx) => (
                      <div key={idx} className="border rounded-md p-3 bg-background">
                        <p className="text-sm font-medium mb-1">Карточка #{idx + 1}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.trim()}</p>
                      </div>
                    ))}
                  {listInput.split(/\n---\n|\n\n/).filter((item) => item.trim()).length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{listInput.split(/\n---\n|\n\n/).filter((item) => item.trim()).length - 3} товаров...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={handleGenerateBatch}
            disabled={!listInput.trim()}
            size="lg"
            className="w-full gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Сгенерировать {Math.max(1, listInput.split(/\n---\n|\n\n/).filter((i) => i.trim()).length)} карточек
          </Button>
        </TabsContent>

        {/* Tab 2: Загрузить файл */}
        <TabsContent value="file" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Загрузить CSV или XLSX</CardTitle>
              <CardDescription>Структура: столбцы 'name', 'description' или 'features'</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload area */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Выбери файл или перетащи его сюда</p>
                    <p className="text-xs text-muted-foreground">CSV или XLSX (макс 5 MB)</p>
                  </div>
                </label>
              </div>

              {fileInput && (
                <div className="bg-muted/50 p-3 rounded-md flex items-center justify-between">
                  <span className="text-sm font-medium">{fileInput.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFileInput(null)}
                  >
                    Удалить
                  </Button>
                </div>
              )}

              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Пример структуры CSV:</p>
                <pre className="bg-background p-2 rounded border text-xs overflow-x-auto">
{`name,description
Умные часы,"GPS, Bluetooth 5.3"
Наушники,"ANC, 40 часов батареи"`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerateBatch}
            disabled={!fileInput}
            size="lg"
            className="w-full gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Загрузить и сгенерировать
          </Button>
        </TabsContent>
      </Tabs>

      {/* Информация о функции */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Как это работает</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong>1. Подготовка:</strong> Введи описания товаров или загрузи файл со списком.
          </p>
          <p>
            <strong>2. Настройки:</strong> Выбери маркетплейс, стиль, категорию (общие для пакета).
          </p>
          <p>
            <strong>3. Генерация:</strong> Система создаст карточки для всех товаров за один раз.
          </p>
          <p>
            <strong>4. Экспорт:</strong> Скачай результат в Excel или скопируй в буфер обмена.
          </p>
        </CardContent>
      </Card>

      {/* Преимущества */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Зачем это нужно</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <span>✓</span>
            <span>Экономия времени: генерируй 10-100 карточек сразу</span>
          </div>
          <div className="flex gap-2">
            <span>✓</span>
            <span>Единообразность: все карточки в одном стиле</span>
          </div>
          <div className="flex gap-2">
            <span>✓</span>
            <span>Удобство: загрузи файл — получи результат</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
