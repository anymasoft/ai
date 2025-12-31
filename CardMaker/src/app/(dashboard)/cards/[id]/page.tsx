"use client"

import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, Download, CheckCircle, ArrowLeft, RefreshCw } from "lucide-react"
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
  const [description, setDescription] = useState(MOCK_CARD.description)

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    toast.success("Скопировано в буфер обмена")
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const handleRefresh = () => {
    toast.info("Обновление результата (скоро будет доступна)")
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

        {/* BODY - ИНФОРМАЦИЯ О ТОВАРЕ */}
        <div className="space-y-6">
          {/* Наименование товара */}
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Наименование товара
            </h2>
            <p className="text-base">
              {MOCK_CARD.productName}
            </p>
          </div>

          {/* Характеристики */}
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Характеристики
            </h2>
            <p className="text-sm leading-relaxed text-foreground">
              {MOCK_CARD.characteristics}
            </p>
          </div>

          {/* Описание товара - РЕДАКТИРУЕМЫЙ ДОКУМЕНТ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Текст описания карточки
              </h2>
              {/* ДЕЙСТВИЯ - ТОЛЬКО ИКОНКИ */}
              <div className="flex gap-2 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCopy(description, "description")}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      {copiedSection === "description" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Скопировать</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
                      <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Экспорт CSV</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
                      <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Экспорт TXT</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleRefresh}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Обновить результат</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Редактируемая область текста */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-4 rounded-lg border border-border bg-transparent text-sm leading-relaxed font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent placeholder-muted-foreground"
              rows={16}
              placeholder="Введите описание..."
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
