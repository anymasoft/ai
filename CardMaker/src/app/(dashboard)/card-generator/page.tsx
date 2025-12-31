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
import { Copy, CheckCircle, ChevronDown, Loader2 } from "lucide-react"

// Mock данные для примера результата
const MOCK_CARD_RESULT = {
  title: "Спортивные Умные Часы GPS водонепроницаемые - Идеально для Фитнеса",
  description: `Профессиональные спортивные смарт-часы с встроенным GPS, идеальны для любителей фитнеса и бега.

Характеристики:
• GPS + GLONASS + Galileo для точного отслеживания маршрута
• Мониторинг сердечного ритма 24/7 с AI анализом
• 100+ режимов тренировок (бег, плавание, велосипед)
• Водонепроницаемость 50м - можно использовать в бассейне
• Батарея до 14 дней в режиме обычных часов
• Экран AMOLED 1.4" яркий и четкий
• Интеграция с iOS и Android
• Вес 41г - легче чем кредитная карта

Почему выбирают эти часы:
✓ Ультраточный GPS (погрешность ±3м)
✓ Премиум корпус из титанового сплава
✓ Официальная гарантия 24 месяца
✓ Быстрая доставка - в наличии
✓ Русскоязычная техподдержка`,
  keywords: ["спортивные часы", "смарт-часы GPS", "фитнес часы", "часы для бега", "водонепроницаемые часы"],
  whyItWorks: "Описание содержит конкретные характеристики, которые хочет видеть покупатель. Используются стоп-слова вроде 'Идеально', 'Профессиональные'. Товар позиционируется как premium сегмент через упоминание качественных материалов и технологий.",
}

interface CardResult {
  title: string
  description: string
  keywords: string[]
  whyItWorks: string
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
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const handleGenerateCard = async () => {
    // Валидация
    if (!productDescription.trim()) {
      alert("Заполните описание товара")
      return
    }
    if (!marketplace) {
      alert("Выберите маркетплейс")
      return
    }
    if (!category) {
      alert("Выберите категорию товара")
      return
    }

    // Имитация создания карточки
    setIsGenerating(true)
    setTimeout(() => {
      setResult(MOCK_CARD_RESULT)
      setIsGenerating(false)
    }, 1500)
  }

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }


  return (
    <div className="space-y-4 px-4 md:px-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold">Мастер создания карточек товаров</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Для Ozon и Wildberries
        </p>
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
              placeholder="Введите описание товара, его особенности, преимущества..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Опишите подробно: материалы, размеры, особенности, преимущества
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
                  <Label htmlFor="seokeys" className="text-xs font-medium">SEO-ключи</Label>
                  <Textarea
                    id="seokeys"
                    placeholder="Введите список ключевых слов (через запятую или с новой строки)"
                    value={seoKeywords}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                    className="text-sm resize-none min-h-16"
                    rows={2}
                  />
                </div>

                {/* Конкуренты - статическая сетка 3 слота */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Конкуренты (опционально)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {competitors.map((competitor, index) => (
                      <div key={index}>
                        <Textarea
                          placeholder="Описание товара конкурента"
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
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

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
                  Создаём карточку...
                </>
              ) : (
                "Создать карточку"
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

          {/* Название товара */}
          <Card className="border">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">Название товара (SEO)</CardTitle>
                  <CardDescription className="text-xs">Оптимизировано для поиска</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(result.title, "title")}
                  title="Копировать"
                  className="h-8 w-8"
                >
                  {copiedSection === "title" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm font-medium leading-relaxed">{result.title}</p>
            </CardContent>
          </Card>

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

          {/* SEO-ключи */}
          <Card className="border">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">SEO-ключи</CardTitle>
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

          {/* Пояснение почему так */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center gap-2 font-medium text-sm hover:text-primary transition-colors py-1">
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              Почему описание выглядит именно так?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <Card className="border bg-muted/50">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.whyItWorks}
                  </p>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

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
