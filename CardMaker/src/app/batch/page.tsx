"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Copy, Download, Upload, Sparkles, CheckCircle, Clock } from "lucide-react"
import { toast } from "sonner"

const MOCK_RESULTS = [
  { id: 1, name: "Умные часы с GPS", status: "completed" as const },
  { id: 2, name: "Беспроводные наушники", status: "completed" as const },
  { id: 3, name: "Спортивный рюкзак", status: "in-progress" as const },
]

export default function BatchPage() {
  const [listInput, setListInput] = useState("")
  const [fileInput, setFileInput] = useState<File | null>(null)
  const [marketplace, setMarketplace] = useState("ozon")
  const [style, setStyle] = useState("selling")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const handleGenerate = () => {
    if (!marketplace) {
      toast.error("Выберите маркетплейс")
      return
    }
    setIsGenerating(true)
    setShowResults(true)
    setTimeout(() => {
      setIsGenerating(false)
      toast.success("Готово!")
    }, 1500)
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
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!listInput.trim() && !fileInput)}
          title="Подготовить пакет"
          className="ml-auto p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <Sparkles className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </button>
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
            className="min-h-80 resize-y font-normal"
          />
          <p className="text-xs text-muted-foreground">Каждая строка — отдельный товар</p>
        </TabsContent>

        {/* TAB: ФАЙЛ */}
        <TabsContent value="file" className="mt-4 space-y-2">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/30 cursor-pointer transition-colors">
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

      {/* РЕЗУЛЬТАТЫ */}
      {showResults && (
        <div className="space-y-3 mt-6 pt-4 border-t">
          {/* TOOLBAR — только иконки */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  MOCK_RESULTS.map((r) => r.name).join("\n")
                )
                toast.success("Скопировано")
              }}
              title="Скопировать всё"
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              title="Экспорт CSV"
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              title="Экспорт TXT"
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
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
                {MOCK_RESULTS.map((result) => (
                  <tr
                    key={result.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-sm">{result.name}</td>
                    <td className="py-2 px-3 text-xs">
                      {result.status === "completed" ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-blue-600 animate-spin" />
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
  )
}
