"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Copy, CheckCircle, ChevronDown, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

// Mock данные для просмотра карточки
const MOCK_CARD_DATA = {
  "card-001": {
    id: "card-001",
    productTitle: "Спортивные умные часы GPS водонепроницаемые",
    marketplace: "ozon",
    marketplace_label: "Ozon",
    category: "sports",
    style: "selling",
    style_label: "Продающий",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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
  },
  "card-002": {
    id: "card-002",
    productTitle: "Кроссовки спортивные беговые для мужчин",
    marketplace: "wildberries",
    marketplace_label: "Wildberries",
    category: "fashion",
    style: "expert",
    style_label: "Экспертный",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    title: "Беговые кроссовки высокого класса - для профессиональных спортсменов",
    description: "Кроссовки созданы с использованием новейшей технологии амортизации...",
    keywords: ["кроссовки", "беговые кроссовки", "спортивная обувь"],
    whyItWorks: "Использован экспертный стиль описания с акцентом на технологии.",
  },
  "card-003": {
    id: "card-003",
    productTitle: "Ноутбук 15.6 дюймов алюминиевый корпус SSD 512GB",
    marketplace: "ozon",
    marketplace_label: "Ozon",
    category: "electronics",
    style: "brief",
    style_label: "Краткий",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    title: "Ноутбук 15.6\" алюминий SSD 512GB",
    description: "Мощный ноутбук для работы и развлечений. Алюминиевый корпус, SSD 512GB, 16GB RAM, Intel Core i7.",
    keywords: ["ноутбук", "ноутбук 15.6", "ноутбук с SSD"],
    whyItWorks: "Краткое описание, прямое и понятное. Все ключевые характеристики на виду.",
  },
}

interface CardDetailsPageProps {
  params: Promise<{ id: string }>
}

export default function CardDetailsPage({ params }: CardDetailsPageProps) {
  const router = useRouter()
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [id, setId] = useState<string>("")

  // Получаем ID из params (асинхронно)
  React.useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  // Ищем карточку в mock данных
  const card = MOCK_CARD_DATA[id as keyof typeof MOCK_CARD_DATA]

  if (!id || !card) {
    return (
      <div className="space-y-6 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Карточка не найдена</CardTitle>
            <CardDescription>К сожалению, карточка с ID {id} не существует</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/cards-history">
              <Button>Вернуться к истории карточек</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    toast.success("Скопировано в буфер обмена")
    setTimeout(() => setCopiedSection(null), 2000)
  }

  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Кнопка назад */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к истории
        </Button>
      </div>

      {/* Заголовок и мета-информация */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold line-clamp-2">{card.productTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {card.marketplace_label}
          </Badge>
          <Badge variant="secondary">{card.style_label}</Badge>
          <span className="text-xs text-muted-foreground">
            {card.createdAt.toLocaleDateString("ru-RU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Название товара (SEO) */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base">Название товара (SEO)</CardTitle>
              <CardDescription className="text-xs">Оптимизировано для поиска</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(card.title, "title")}
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
          <p className="text-sm font-medium leading-relaxed">{card.title}</p>
        </CardContent>
      </Card>

      {/* Описание товара */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base">Описание товара</CardTitle>
              <CardDescription className="text-xs">Полное описание с характеристиками</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(card.description, "description")}
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
            {card.description}
          </div>
        </CardContent>
      </Card>

      {/* SEO-ключи */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base">SEO-ключи</CardTitle>
              <CardDescription className="text-xs">Основные слова для поиска</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(card.keywords.join(", "), "keywords")}
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
            {card.keywords.map((keyword, index) => (
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
                {card.whyItWorks}
              </p>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Кнопка вернуться */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={() => router.push("/cards-history")}>
          Вернуться к истории карточек
        </Button>
      </div>
    </div>
  )
}
