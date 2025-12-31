"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, Download, CheckCircle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

interface CardDetailsProps {
  params: {
    id: string
  }
}

// Mock карточка товара
const MOCK_CARD = {
  id: "1",
  productName: "Умные часы с GPS и пульсометром",
  marketplace: "ozon",
  marketplace_label: "Ozon",
  style: "selling",
  style_label: "Продающий",
  characteristics: `Экран 1.69", AMOLED, IP67, 30 часов батареи, совместимы с iOS и Android, вес 41г`,
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
}

export default function CardDetailsPage({ params }: CardDetailsProps) {
  const router = useRouter()
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    toast.success("Скопировано в буфер обмена")
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const handleEdit = () => {
    toast.info("Функция редактирования (скоро будет доступна)")
  }

  const handleRegenerate = () => {
    toast.info("Функция переподготовки (скоро будет доступна)")
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 px-4 md:px-6 py-4">
        {/* Кнопка назад */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Вернуться
        </button>

        {/* HEADER */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{MOCK_CARD.productName}</h1>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">
                  {MOCK_CARD.marketplace_label}
                </Badge>
                <Badge variant="outline">
                  {MOCK_CARD.style_label}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* TOOLBAR ДЕЙСТВИЙ - ИКОНКИ С TOOLTIP */}
        <div className="flex gap-2 items-center p-4 bg-muted/30 rounded-lg w-fit">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleCopy(MOCK_CARD.description, "description")}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                {copiedSection === "description" ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Скопировать описание</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-2 rounded-md hover:bg-muted transition-colors">
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Экспорт в CSV</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-2 rounded-md hover:bg-muted transition-colors">
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Экспорт в TXT</TooltipContent>
          </Tooltip>
        </div>

        {/* BODY - ИНФОРМАЦИЯ О ТОВАРЕ */}
        <div className="space-y-6">
          {/* Наименование товара */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Наименование товара
            </h2>
            <div className="bg-muted/50 p-4 rounded-lg text-sm">
              {MOCK_CARD.productName}
            </div>
          </div>

          {/* Характеристики */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Характеристики
            </h2>
            <div className="bg-muted/50 p-4 rounded-lg text-sm leading-relaxed">
              {MOCK_CARD.characteristics}
            </div>
          </div>

          {/* Описание товара */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Текст описания карточки
            </h2>
            <div className="bg-muted/50 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
              {MOCK_CARD.description}
            </div>
          </div>
        </div>

        {/* ACTIONS - КНОПКИ */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleEdit}
            variant="outline"
            className="flex-1 gap-2"
          >
            Редактировать
          </Button>
          <Button
            onClick={handleRegenerate}
            className="flex-1 gap-2"
          >
            Переподготовить
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
