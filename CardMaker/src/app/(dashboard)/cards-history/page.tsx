"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RefreshCcw, Copy, CheckCircle, Sparkles } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// Mock данные истории карточек
const MOCK_CARDS_HISTORY = [
  {
    id: "card-001",
    productTitle: "Спортивные умные часы GPS водонепроницаемые",
    marketplace: "ozon",
    marketplace_label: "Ozon",
    category: "sports",
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 дня назад
  },
  {
    id: "card-002",
    productTitle: "Кроссовки спортивные беговые для мужчин",
    marketplace: "wildberries",
    marketplace_label: "Wildberries",
    category: "fashion",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 дней назад
  },
  {
    id: "card-003",
    productTitle: "Ноутбук 15.6 дюймов алюминиевый корпус SSD 512GB",
    marketplace: "ozon",
    marketplace_label: "Ozon",
    category: "electronics",
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 дней назад
  },
]

const MARKETPLACE_COLORS: Record<string, string> = {
  ozon: "bg-blue-100 text-blue-800",
  wildberries: "bg-purple-100 text-purple-800",
}

export default function CardsHistoryPage() {
  const router = useRouter()
  const [cards, setCards] = useState(MOCK_CARDS_HISTORY)
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return format(date, "dd.MM.yyyy HH:mm", { locale: ru })
  }

  const formatRelativeDate = (timestamp: number) => {
    const now = new Date()
    const cardDate = new Date(timestamp)
    const diffTime = now.getTime() - cardDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "сегодня"
    if (diffDays === 1) return "вчера"
    return `${diffDays} дней назад`
  }

  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.info("Список карточек обновлён")
    }, 1000)
  }

  const handleCopy = (title: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Не переходить на страницу карточки при клике на Copy
    navigator.clipboard.writeText(title)
    setCopiedId(id)
    toast.success("Скопировано в буфер обмена")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRegenerate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Не переходить на страницу карточки при клике на Regenerate
    toast.info("Функция перегенерации (скоро будет доступна)")
  }

  const handleRowClick = (cardId: string) => {
    router.push(`/cards/${cardId}`)
  }

  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">История карточек</h1>
          <p className="text-muted-foreground mt-1">
            Все созданные карточки товаров
          </p>
        </div>

        {/* Кнопка обновления */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Обновить список карточек</TooltipContent>
        </Tooltip>
      </div>

      {/* Список карточек */}
      {cards.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Карточек пока нет</CardTitle>
            <CardDescription>
              Создайте свою первую карточку товара
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Перейдите в раздел "Создание карточки" чтобы создать описание товара.
            </p>
            <Link href="/card-generator">
              <Button>Создать карточку</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Все карточки</CardTitle>
            <CardDescription>
              Показано {cards.length} карточек. Сортировка по дате создания (новые сверху)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Товар</TableHead>
                    <TableHead className="min-w-[120px]">Маркетплейс</TableHead>
                    <TableHead className="min-w-[120px]">Создана</TableHead>
                    <TableHead className="w-[80px] text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((card) => (
                    <TableRow
                      key={card.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleRowClick(card.id)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm line-clamp-2" title={card.productTitle}>
                            {card.productTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {card.id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={MARKETPLACE_COLORS[card.marketplace] || "bg-gray-100 text-gray-800"}
                        >
                          {card.marketplace_label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm">
                            {formatDate(card.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeDate(card.createdAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleCopy(card.productTitle, card.id, e)}
                              >
                                {copiedId === card.id ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Копировать название</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleRegenerate(card.id, e)}
                              >
                                <RefreshCcw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Перегенерировать (скоро)</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Всего карточек:</strong> {cards.length}
              </p>
              <p>
                Чтобы создать новую карточку, перейдите в раздел "Создание карточки".
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
