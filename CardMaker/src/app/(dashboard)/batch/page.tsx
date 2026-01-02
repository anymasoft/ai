"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, Download, Upload, Sparkles, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface BatchItem {
  id: string
  name: string
  status: "queued" | "processing" | "completed" | "failed"
}

export default function BatchPage() {
  const [listInput, setListInput] = useState("")
  const [fileInput, setFileInput] = useState<File | null>(null)
  const [marketplace, setMarketplace] = useState("ozon")
  const [category, setCategory] = useState("")
  const [style, setStyle] = useState("selling")
  const [isGenerating, setIsGenerating] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [results, setResults] = useState<BatchItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Polling для обновления статусов
  useEffect(() => {
    if (!batchId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/batch/${batchId}`)
        if (!response.ok) throw new Error("Ошибка при загрузке статуса")
        const data = await response.json()
        setResults(data.items)

        // Если все завершено, остановить polling
        if (data.items.every((item: BatchItem) => item.status === "completed" || item.status === "failed")) {
          setIsGenerating(false)
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 2000) // Опрашиваем каждые 2 сек

    return () => clearInterval(pollInterval)
  }, [batchId])

  const handleGenerate = async () => {
    if (!marketplace) {
      setError("Выберите маркетплейс")
      return
    }

    if (!category) {
      setError("Выберите категорию товара")
      return
    }

    if (!listInput.trim() && !fileInput) {
      setError("Введите список товаров или загрузьте файл")
      return
    }

    setIsGenerating(true)
    setError(null)
    setResults([])

    try {
      // Парсим список товаров - каждая строка = description товара
      const descriptions = listInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)

      // Преобразуем в формат API: { description, category, seoKeywords }
      const items = descriptions.map((description) => ({
        description,
        category,
        seoKeywords: [],
      }))

      const response = await fetch("/api/batch/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketplace,
          style,
          items,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка при создании батча")
      }

      const data = await response.json()
      setBatchId(data.batchId)
      // Инициализируем пустой массив, он заполнится через polling
      setResults([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
      setIsGenerating(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.name.endsWith(".csv") || file.name.endsWith(".xlsx")) {
        setFileInput(file)
        toast.success(`${file.name} выбран`)
      } else {
        toast.error("Только CSV или XLSX")
      }
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 px-4 md:px-6 py-4">
        {/* HEADER */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Массовая подготовка карточек</h1>
          <p className="text-muted-foreground mb-3">Подготовьте сразу несколько карточек товаров из списка или файла</p>
          <Badge variant="outline" className="border-purple-600/50 text-purple-700 dark:text-purple-400">
            Premium
          </Badge>
        </div>

        {/* ВЕРХНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ — В ОДНУ СТРОКУ */}
        <div className="flex items-end gap-3 bg-muted/40 p-4 rounded-lg">
          {/* Маркетплейс */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Маркетплейс</label>
            <div className="flex gap-1 bg-background rounded-md p-0.5">
              {[
                { value: "ozon", label: "Ozon" },
                { value: "wb", label: "WB" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMarketplace(opt.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    marketplace === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Категория товара */}
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="batch-category" className="text-xs font-medium">Категория товара *</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="batch-category" className="h-9 text-sm">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="electronics">Электроника</SelectItem>
                <SelectItem value="fashion">Одежда и обувь</SelectItem>
                <SelectItem value="home">Товары для дома</SelectItem>
                <SelectItem value="sports">Спорт и фитнес</SelectItem>
                <SelectItem value="beauty">Красота и здоровье</SelectItem>
                <SelectItem value="toys">Игрушки и хобби</SelectItem>
                <SelectItem value="books">Книги и медиа</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Стиль */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Стиль</label>
            <div className="flex gap-1">
              {[
                { value: "selling", label: "Продающий" },
                { value: "expert", label: "Экспертный" },
                { value: "brief", label: "Краткий" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStyle(opt.value)}
                  className={`px-2.5 py-1.5 rounded text-xs transition-all border ${
                    style === opt.value
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Кнопка запуска — только иконка */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (!listInput.trim() && !fileInput)}
                className="ml-auto p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <Sparkles className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Подготовить пакет</TooltipContent>
          </Tooltip>
        </div>

        {/* TABS — Список / Файл */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="list">Вставить список</TabsTrigger>
            <TabsTrigger value="file">Загрузить файл</TabsTrigger>
          </TabsList>

          {/* TAB: СПИСОК */}
          <TabsContent value="list" className="mt-4 space-y-2">
            <Textarea
              placeholder={`Умные часы с GPS и пульсометром. Экран 1.69", IP67, 30 часов работы, совместимы с iOS и Android.
Беспроводные наушники с активным шумоподавлением, Bluetooth 5.3, до 40 часов работы.
Спортивный рюкзак. Объём 30л, влагозащита IPX4, удобные лямки.`}
              value={listInput}
              onChange={(e) => setListInput(e.target.value)}
              className="min-h-40 resize-none font-normal"
            />
            <p className="text-xs text-muted-foreground">Каждая строка — отдельный товар</p>
          </TabsContent>

          {/* TAB: ФАЙЛ */}
          <TabsContent value="file" className="mt-4 space-y-2">
            <div className="min-h-40 border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/30 cursor-pointer transition-colors flex items-center justify-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">Загрузите CSV или XLSX файл</p>
                <p className="text-xs text-muted-foreground">(до 10 MB)</p>
              </label>
            </div>
            {fileInput && (
              <div className="bg-muted p-2 rounded text-sm flex justify-between items-center">
                <span>{fileInput.name}</span>
                <button
                  onClick={() => setFileInput(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Каждая строка — отдельный товар</p>
          </TabsContent>
        </Tabs>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Ошибка</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* РЕЗУЛЬТАТЫ */}
      {results.length > 0 && (
        <div className="space-y-3 mt-6 pt-4 border-t">
          {/* TOOLBAR — только иконки */}
          <div className="flex gap-2 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      results.map((r) => r.name).join("\n")
                    )
                    toast.success("Скопировано")
                  }}
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Скопировать всё</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Экспорт CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Экспорт TXT</TooltipContent>
            </Tooltip>
          </div>

          {/* ТАБЛИЦА */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium text-xs">Товар</th>
                  <th className="text-left py-2 px-3 font-medium text-xs w-12">Статус</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr
                    key={result.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-sm">{result.name}</td>
                    <td className="py-2 px-3 text-xs">
                      {result.status === "completed" && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Готово</span>
                        </div>
                      )}
                      {result.status === "processing" && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-blue-600 animate-spin" />
                          <span className="text-blue-600">Обработка</span>
                        </div>
                      )}
                      {result.status === "queued" && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-600" />
                          <span className="text-gray-600">В очереди</span>
                        </div>
                      )}
                      {result.status === "failed" && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <span className="text-red-600">Ошибка</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </TooltipProvider>
  )
}
