"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Copy, CheckCircle, ChevronDown, Loader2, Sparkles, AlertCircle } from "lucide-react"

interface CardResult {
  title: string
  description: string
  keywords?: string[]
  explanation?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  generatedAt?: string
}

export default function CardGeneratorPage() {
  // Form state
  const [productDescription, setProductDescription] = useState("")
  const [marketplace, setMarketplace] = useState("")
  const [category, setCategory] = useState("")
  const [style, setStyle] = useState("selling")
  const [seoKeywords, setSeoKeywords] = useState("")
  const [competitors, setCompetitors] = useState(["", "", ""])

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<CardResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const handleGenerateCard = async () => {
    // Валидация
    if (!productDescription.trim()) {
      setError("Заполните описание товара")
      return
    }
    if (!marketplace) {
      setError("Выберите маркетплейс")
      return
    }
    if (!category) {
      setError("Выберите категорию товара")
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDescription,
          marketplace,
          category,
          style,
          seoKeywords: seoKeywords ? seoKeywords.split(",").map((k) => k.trim()) : [],
          competitors: competitors.filter((c) => c.trim()),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка при генерации карточки")
      }

      const data = await response.json()
      // API возвращает { success: true, data: CardResult }
      if (data.success && data.data) {
        setResult(data.data)
      } else {
        throw new Error("Неверный формат ответа от API")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }


  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Заголовок с бэйджем */}
      <div className="text-center pt-2">
        <h1 className="text-3xl font-bold mb-3">Мастер создания карточек товаров</h1>
        <Badge variant="outline" className="border-green-600/50 text-green-700 dark:text-green-400 inline-block">
          Проходит требования Ozon / Wildberries
        </Badge>
      </div>

      {/* ФОРМА СОЗДАНИЯ КАРТОЧКИ */}
      <Card>
        <CardHeader>
          <CardTitle>Опишите свой товар</CardTitle>
          <CardDescription>Мы создадим привлекательную карточку для маркетплейса</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar: Маркетплейс + Категория + Стиль в одну строку */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-end">
            {/* Маркетплейс - компактный segmented control */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Маркетплейс *</Label>
              <div className="flex gap-1 bg-muted p-0.5 rounded-md w-fit">
                {[
                  { value: "ozon", label: "Ozon" },
                  { value: "wildberries", label: "WB" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer transition-all ${
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

            {/* Категория товара - растягивающийся элемент */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category" className="text-xs font-medium">Категория *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="h-9 text-sm">
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

            {/* Стиль описания - компактные inline кнопки */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Стиль</Label>
              <div className="flex gap-1">
                {[
                  { value: "selling", label: "Продающий" },
                  { value: "expert", label: "Экспертный" },
                  { value: "brief", label: "Краткий" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`px-2 py-1.5 rounded text-xs cursor-pointer transition-all border ${
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

          {/* Основное описание товара - центральный элемент */}
          <div className="space-y-2 pt-2">
            <Label htmlFor="description" className="font-semibold">Описание товара *</Label>
            <Textarea
              id="description"
              placeholder="Пример: Беспроводные наушники TWS. Bluetooth 5.3, ANC шумоподавление, 30 часов с кейсом, сенсорное управление, встроенный микрофон, USB-C. Идеальны для спорта, прогулок и путешествий. Корпус из премиум-пластика, прочные и легкие."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Пиши как для покупателя: что это, для кого, ключевые характеристики, комплектация, материалы, размеры, преимущества.
            </p>
          </div>

          {/* Дополнительные настройки - коллапсируемый блок */}
          <div className="pt-2">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors font-medium text-sm">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                Дополнительные настройки
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4 ml-0">
                {/* SEO-ключи - textarea, компактный */}
                <div className="space-y-2">
                  <Label htmlFor="seokeys" className="text-xs font-medium">SEO-ключи (опционально)</Label>
                  <Textarea
                    id="seokeys"
                    placeholder="умные часы&#10;часы с GPS&#10;фитнес трекер&#10;smart watch&#10;водонепроницаемые часы"
                    value={seoKeywords}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                    className="text-sm resize-none min-h-16"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Можно с новой строки или через запятую. Оставь пустым, если не знаешь.
                  </p>
                </div>

                {/* Конкуренты - статическая сетка 3 слота */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Описания конкурентов (опционально)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {competitors.map((competitor, index) => (
                      <div key={index}>
                        <Textarea
                          placeholder={
                            index === 0
                              ? "Пример: Смарт-часы с GPS и пульсометром. Экран 1.69\", влагозащита IP67, 12 режимов спорта, уведомления, ремешок силикон..."
                              : index === 1
                              ? "Пример: Беспроводные наушники с активным шумоподавлением ANC. Батарея 30 часов, Bluetooth 5.3, сенсорное управление, USB-C зарядка..."
                              : "Пример: Фитнес-браслет с измерением пульса и давления. Водонепроницаемость 50м, 100+ режимов спорта, экран AMOLED, уведомления со смартфона..."
                          }
                          value={competitor}
                          onChange={(e) => {
                            const newCompetitors = [...competitors]
                            newCompetitors[index] = e.target.value
                            setCompetitors(newCompetitors)
                          }}
                          className="text-sm resize-none min-h-16"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Вставь текст из карточки конкурента (можно частично). Пустые поля игнорируются.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Ошибка</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Кнопка создания */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleGenerateCard}
              disabled={isGenerating || !productDescription.trim() || !marketplace || !category}
              size="lg"
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </>
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* РЕЗУЛЬТАТ СОЗДАНИЯ */}
      {result && (
        <div className="space-y-3">
          <div className="pt-2">
            <h2 className="text-2xl font-bold">Ваша карточка готова</h2>
            <p className="text-muted-foreground text-sm mt-1">Скопируйте текст и используйте на маркетплейсе</p>
          </div>

          {/* Описание товара */}
          <Card className="border">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">Описание товара</CardTitle>
                  <CardDescription className="text-xs">Полное описание с характеристиками</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(result.description, "description")}
                  title="Копировать"
                  className="h-8 w-8"
                >
                  {copiedSection === "description" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap leading-relaxed">
                {result.description}
              </div>
            </CardContent>
          </Card>

                    {/* Ключевые слова */}
          {Array.isArray(result.keywords) && result.keywords.length > 0 && (
            <Card className="border">
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base">Ключевые слова</CardTitle>
                    <CardDescription className="text-xs">Основные слова для поиска</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(result.keywords.join(", "), "keywords")}
                    title="Копировать"
                    className="h-8 w-8"
                  >
                    {copiedSection === "keywords" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Пояснение почему так */}
          {result.explanation && result.explanation.trim().length > 0 && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 font-medium text-sm hover:text-primary transition-colors py-1">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                Почему описание выглядит именно так?
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <Card className="border bg-muted/50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {result.explanation}
                    </p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}


          {/* Кнопка создать ещё одну карточку */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null)
                setProductDescription("")
                setMarketplace("")
                setCategory("")
              }}
            >
              Создать ещё одну карточку
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
