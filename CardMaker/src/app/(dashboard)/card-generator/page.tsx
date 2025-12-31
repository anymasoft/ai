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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, CheckCircle, ChevronDown, Loader2 } from "lucide-react"
import { useState as useStateHook } from "react"

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
  const [competitors, setCompetitors] = useState([""])

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

  const handleAddCompetitor = () => {
    setCompetitors([...competitors, ""])
  }

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold">Мастер создания карточек товаров</h1>
        <p className="text-muted-foreground mt-1">
          Для Ozon и Wildberries
        </p>
      </div>

      {/* ФОРМА СОЗДАНИЯ КАРТОЧКИ */}
      <Card>
        <CardHeader>
          <CardTitle>Опишите свой товар</CardTitle>
          <CardDescription>Мы создадим привлекательную карточку для маркетплейса</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Основное описание товара */}
          <div className="space-y-2">
            <Label htmlFor="description">Описание товара *</Label>
            <Textarea
              id="description"
              placeholder="Введите описание товара, его особенности, преимущества..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Опишите товар подробно: материалы, размеры, комплектацию, преимущества
            </p>
          </div>

          {/* Маркетплейс */}
          <div className="space-y-2">
            <Label htmlFor="marketplace">Маркетплейс *</Label>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger id="marketplace">
                <SelectValue placeholder="Выберите маркетплейс" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ozon">Ozon</SelectItem>
                <SelectItem value="wildberries">Wildberries</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Категория товара */}
          <div className="space-y-2">
            <Label htmlFor="category">Категория товара *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
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

          {/* Дополнительные настройки */}
          <div className="border-t pt-6">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                <span className="font-medium text-sm">Дополнительные настройки</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                {/* Стиль описания */}
                <div className="space-y-2">
                  <Label>Стиль описания</Label>
                  <div className="space-y-2">
                    {[
                      { value: "selling", label: "Продающий", desc: "Фокус на преимущества и выгоду" },
                      { value: "expert", label: "Экспертный", desc: "Технические характеристики и спецификации" },
                      { value: "brief", label: "Краткий", desc: "Минимум текста, максимум фактов" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-start gap-3 p-2 rounded border border-border cursor-pointer hover:bg-muted/50">
                        <input
                          type="radio"
                          name="style"
                          value={option.value}
                          checked={style === option.value}
                          onChange={() => setStyle(option.value)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium text-sm">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* SEO-ключи */}
                <div className="space-y-2">
                  <Label htmlFor="seokeys">SEO-ключи (опционально)</Label>
                  <Input
                    id="seokeys"
                    placeholder="Через запятую: часы GPS, умные часы, фитнес трекер"
                    value={seoKeywords}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ключевые слова помогут улучшить видимость в поиске
                  </p>
                </div>

                {/* Конкуренты */}
                <div className="space-y-2">
                  <Label>Конкуренты (опционально)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Сравните ваш товар с конкурентами чтобы выделить преимущества
                  </p>
                  {competitors.map((competitor, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Опишите конкурента ${index + 1}`}
                        value={competitor}
                        onChange={(e) => {
                          const newCompetitors = [...competitors]
                          newCompetitors[index] = e.target.value
                          setCompetitors(newCompetitors)
                        }}
                      />
                      {competitors.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCompetitor(index)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                  {competitors.length < 3 && (
                    <Button variant="outline" size="sm" onClick={handleAddCompetitor}>
                      + Добавить конкурента
                    </Button>
                  )}
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
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold">Ваша карточка готова</h2>
            <p className="text-muted-foreground text-sm">Скопируйте текст и используйте на маркетплейсе</p>
          </div>

          {/* Название товара */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Название товара (SEO)</CardTitle>
                  <CardDescription>Оптимизировано для поиска</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(result.title, "title")}
                  className="gap-2"
                >
                  {copiedSection === "title" ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Копировать
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium leading-relaxed">{result.title}</p>
            </CardContent>
          </Card>

          {/* Описание товара */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Описание товара</CardTitle>
                  <CardDescription>Полное описание с характеристиками</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(result.description, "description")}
                  className="gap-2"
                >
                  {copiedSection === "description" ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Копировать
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-4 rounded-md text-sm whitespace-pre-wrap leading-relaxed">
                {result.description}
              </div>
            </CardContent>
          </Card>

          {/* SEO-ключи */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">SEO-ключи</CardTitle>
                  <CardDescription>Основные слова для поиска</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(result.keywords.join(", "), "keywords")}
                  className="gap-2"
                >
                  {copiedSection === "keywords" ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Копировать
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Пояснение почему так */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center gap-2 font-medium text-sm hover:text-primary transition-colors">
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              Почему описание выглядит именно так?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {result.whyItWorks}
                  </p>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Кнопка создать ещё одну карточку */}
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
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
