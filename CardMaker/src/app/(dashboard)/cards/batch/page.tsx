"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, Sparkles, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

// Mock результаты генерации
const MOCK_RESULTS = [
  {
    id: 1,
    name: "Умные часы с GPS",
    status: "completed" as const,
    timestamp: "2 минуты назад",
  },
  {
    id: 2,
    name: "Беспроводные наушники",
    status: "completed" as const,
    timestamp: "1 минуту назад",
  },
  {
    id: 3,
    name: "Спортивный рюкзак",
    status: "in-progress" as const,
    timestamp: "сейчас",
  },
]

export default function BatchGenerationPage() {
  const [listInput, setListInput] = useState("")
  const [fileInput, setFileInput] = useState<File | null>(null)
  const [marketplace, setMarketplace] = useState("")
  const [style, setStyle] = useState("selling")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const handleGenerateBatch = () => {
    if (!marketplace) {
      toast.error("Выберите маркетплейс")
      return
    }

    setIsGenerating(true)
    setShowResults(true)
    setTimeout(() => {
      setIsGenerating(false)
      toast.success("Карточки готовы!")
    }, 2000)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.name.endsWith(".csv") || file.name.endsWith(".xlsx")) {
        setFileInput(file)
        toast.success(`Файл ${file.name} выбран`)
      } else {
        toast.error("Загружай только CSV или XLSX файлы")
      }
    }
  }

  const productCount = Math.max(
    1,
    listInput
      .split(/\n---\n|\n\n/)
      .filter((i) => i.trim()).length
  )

  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Заголовок с Premium бэйджем */}
      <div className="text-center pt-2">
        <h1 className="text-3xl font-bold mb-3">Массовая подготовка карточек</h1>
        <Badge variant="outline" className="border-purple-600/50 text-purple-700 dark:text-purple-400 inline-block mb-3">
          Premium
        </Badge>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Подготовьте сразу несколько карточек товаров из списка или загрузите файл со всеми описаниями
        </p>
      </div>

      {/* Основной интерфейс - вкладки */}
      <Card>
        <CardHeader>
          <Tabs defaultValue="list" className="w-full -mt-6 -mx-6">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="list" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Вставить списком
              </TabsTrigger>
              <TabsTrigger value="file" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Загрузить файл
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {/* Tab 1: Вставить список */}
              <TabsContent value="list" className="space-y-4 mt-0">
                <Textarea
                  placeholder={`Умные часы с GPS. Bluetooth 5.3, водонепроницаемость IP67, 30 часов батареи, совместимы с iOS и Android, идеальны для спорта и путешествий.
---
Беспроводные наушники. Active Noise Cancellation, 40 часов работы, Bluetooth 5.3, сенсорное управление, USB-C зарядка, премиум звук.
---
Спортивный рюкзак. Объём 30л, влагозащита IPX4, множество карманов, светоотражающие элементы, удобные лямки, подходит для туризма и путешествий.`}
                  value={listInput}
                  onChange={(e) => setListInput(e.target.value)}
                  className="min-h-48 resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Разделяй товары пустой строкой или текстом '---' на отдельной строке. Каждое описание будет преобразовано в отдельную карточку.
                </p>
              </TabsContent>

              {/* Tab 2: Загрузить файл */}
              <TabsContent value="file" className="space-y-4 mt-0">
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
                      <p className="text-xs text-muted-foreground">CSV или XLSX (макс 10 MB)</p>
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
                  <p className="font-medium text-foreground">Структура файла (столбцы):</p>
                  <pre className="bg-background p-2 rounded border text-xs overflow-x-auto">
{`name,description
Умные часы,"GPS, Bluetooth 5.3, 30 часов батареи"
Наушники,"ANC, 40 часов работы, Bluetooth 5.3"`}
                  </pre>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardHeader>
      </Card>

      {/* Общие настройки */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Общие настройки для всех карточек</CardTitle>
          <CardDescription>Эти параметры применятся ко всем товарам в пакете</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Маркетплейс */}
            <div className="space-y-2">
              <Label htmlFor="marketplace" className="text-sm font-medium">Маркетплейс *</Label>
              <div className="flex gap-1 bg-muted p-0.5 rounded-md w-fit">
                {[
                  { value: "ozon", label: "Ozon" },
                  { value: "wildberries", label: "WB" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all ${
                      marketplace === option.value
                        ? "bg-background shadow-sm border border-primary/20"
                        : "hover:text-primary"
                    }`}
                  >
                    <input
                      type="radio"
                      name="marketplace"
                      value={option.value}
                      checked={marketplace === option.value}
                      onChange={() => setMarketplace(option.value)}
                      className="hidden"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Стиль */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Стиль описания</Label>
              <div className="flex gap-1">
                {[
                  { value: "selling", label: "Продающий" },
                  { value: "expert", label: "Экспертный" },
                  { value: "brief", label: "Краткий" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`px-2.5 py-1.5 rounded text-xs cursor-pointer transition-all border ${
                      style === option.value
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-transparent hover:border-border/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="style"
                      value={option.value}
                      checked={style === option.value}
                      onChange={() => setStyle(option.value)}
                      className="hidden"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Button */}
      <Button
        onClick={handleGenerateBatch}
        disabled={isGenerating || (!listInput.trim() && !fileInput) || !marketplace}
        size="lg"
        className="w-full gap-2"
      >
        {isGenerating ? (
          <>
            <Sparkles className="h-4 w-4 animate-spin" />
            Подготавливаем пакет...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Подготовить пакет ({listInput ? productCount : fileInput ? "N" : "0"} товаров)
          </>
        )}
      </Button>

      {/* Mock Results Table */}
      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Результаты подготовки</CardTitle>
            <CardDescription>Статус каждой карточки в пакете</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-xs">Название</th>
                    <th className="text-left py-2 px-2 font-medium text-xs">Статус</th>
                    <th className="text-right py-2 px-2 font-medium text-xs">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_RESULTS.map((result) => (
                    <tr key={result.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-sm">{result.name}</p>
                          <p className="text-xs text-muted-foreground">{result.timestamp}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {result.status === "completed" ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-xs font-medium text-green-700 dark:text-green-400">Готово</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-blue-600 animate-spin" />
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">В процессе</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {result.status === "completed" && (
                          <Button variant="ghost" size="sm" className="text-xs">
                            Скопировать
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Helper Text */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Массовая подготовка vs Одиночная</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-foreground mb-2">Одиночная подготовка:</p>
              <ul className="space-y-1">
                <li>✓ Тонкая настройка каждой карточки</li>
                <li>✓ SEO-ключи и конкуренты</li>
                <li>✓ Для 1-2 товаров</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Массовая подготовка:</p>
              <ul className="space-y-1">
                <li>✓ Быстро обработать 10-100 товаров</li>
                <li>✓ Единообразный стиль всех карточек</li>
                <li>✓ Загрузить из файла за раз</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
