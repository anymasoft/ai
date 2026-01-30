"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  IconCalendar,
  IconFilter,
  IconSearch,
  IconMessage,
  IconExternalLink,
  IconDownload,
  IconRefresh,
} from "@tabler/icons-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface Message {
  id: string
  channel: string
  channelName: string
  content: string
  keyword: string
  timestamp: string
  messageId: number
  sentiment: "positive" | "negative" | "neutral"
  views: number
  forwards: number
  reactions: number
}

const messagesData: Message[] = [
  {
    id: "1",
    channel: "@tech_news_ru",
    channelName: "Технологические новости",
    content:
      "Новые достижения в области искусственного интеллекта открывают невероятные возможности для автоматизации бизнес-процессов. Компания OpenAI представила обновленную модель GPT-4, которая показывает значительные улучшения в понимании контекста и генерации текста.",
    keyword: "искусственный интеллект",
    timestamp: "2024-01-07 15:30",
    messageId: 12345,
    sentiment: "positive",
    views: 2340,
    forwards: 45,
    reactions: 128,
  },
  {
    id: "2",
    channel: "@startup_digest",
    channelName: "Стартап дайджест",
    content:
      "Российский стартап в области финтеха привлек $5M инвестиций серии A. Компания разрабатывает платформу для автоматизации бухгалтерского учета малого и среднего бизнеса с использованием машинного обучения.",
    keyword: "стартап",
    timestamp: "2024-01-07 13:45",
    messageId: 67890,
    sentiment: "positive",
    views: 1890,
    forwards: 32,
    reactions: 89,
  },
  {
    id: "3",
    channel: "@crypto_analytics",
    channelName: "Криптоаналитика",
    content:
      "Анализ движения биткоина на этой неделе показывает консолидацию в диапазоне $42,000-$45,000. Технические индикаторы указывают на возможный прорыв вверх в ближайшие дни, однако следует учитывать высокую волатильность рынка.",
    keyword: "биткоин",
    timestamp: "2024-01-07 12:15",
    messageId: 54321,
    sentiment: "neutral",
    views: 3450,
    forwards: 78,
    reactions: 156,
  },
  {
    id: "4",
    channel: "@market_news",
    channelName: "Рыночные новости",
    content:
      "Обзор рынка технологий за январь: акции IT-компаний показали смешанную динамику. Лидерами роста стали компании, специализирующиеся на искусственном интеллекте и облачных технологиях.",
    keyword: "рынок",
    timestamp: "2024-01-07 11:20",
    messageId: 98765,
    sentiment: "neutral",
    views: 1567,
    forwards: 23,
    reactions: 67,
  },
  {
    id: "5",
    channel: "@startup_digest",
    channelName: "Стартап дайджест",
    content:
      "Венчурные инвестиции в российские стартапы в 2024 году могут превысить показатели прошлого года. Особый интерес инвесторов вызывают проекты в области EdTech, FinTech и HealthTech.",
    keyword: "инвестиции",
    timestamp: "2024-01-07 10:30",
    messageId: 11111,
    sentiment: "positive",
    views: 2100,
    forwards: 41,
    reactions: 95,
  },
]

export default function HistoryPage() {
  const [messages, setMessages] = useState<Message[]>(messagesData)
  const [filteredMessages, setFilteredMessages] = useState<Message[]>(messagesData)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<string>("all")
  const [selectedKeyword, setSelectedKeyword] = useState<string>("all")
  const [selectedSentiment, setSelectedSentiment] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()

  const channels = Array.from(new Set(messages.map((m) => m.channel)))
  const keywords = Array.from(new Set(messages.map((m) => m.keyword)))

  const applyFilters = () => {
    let filtered = messages

    if (searchTerm) {
      filtered = filtered.filter(
        (message) =>
          message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          message.channelName.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (selectedChannel !== "all") {
      filtered = filtered.filter((message) => message.channel === selectedChannel)
    }

    if (selectedKeyword !== "all") {
      filtered = filtered.filter((message) => message.keyword === selectedKeyword)
    }

    if (selectedSentiment !== "all") {
      filtered = filtered.filter((message) => message.sentiment === selectedSentiment)
    }

    if (dateFrom) {
      filtered = filtered.filter((message) => new Date(message.timestamp) >= dateFrom)
    }

    if (dateTo) {
      filtered = filtered.filter((message) => new Date(message.timestamp) <= dateTo)
    }

    setFilteredMessages(filtered)
  }

  const resetFilters = () => {
    setSearchTerm("")
    setSelectedChannel("all")
    setSelectedKeyword("all")
    setSelectedSentiment("all")
    setDateFrom(undefined)
    setDateTo(undefined)
    setFilteredMessages(messages)
  }

  const getSentimentBadge = (sentiment: Message["sentiment"]) => {
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-100 text-green-800">Позитивная</Badge>
      case "negative":
        return <Badge className="bg-red-100 text-red-800">Негативная</Badge>
      case "neutral":
        return <Badge variant="secondary">Нейтральная</Badge>
    }
  }

  const exportData = () => {
    const csvContent = [
      ["Канал", "Сообщение", "Ключевое слово", "Время", "Тональность", "Просмотры"].join(","),
      ...filteredMessages.map((msg) =>
        [
          msg.channel,
          `"${msg.content.replace(/"/g, '""')}"`,
          msg.keyword,
          msg.timestamp,
          msg.sentiment,
          msg.views,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `telegram_history_${format(new Date(), "yyyy-MM-dd")}.csv`
    link.click()
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="@container/main">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">История сообщений</h1>
                  <p className="text-muted-foreground">
                    Просматривайте и анализируйте найденные упоминания ключевых слов
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportData}>
                    <IconDownload className="mr-2 h-4 w-4" />
                    Экспорт
                  </Button>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    <IconRefresh className="mr-2 h-4 w-4" />
                    Обновить
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconFilter className="h-5 w-5" />
                    Фильтры
                  </CardTitle>
                  <CardDescription>Настройте фильтры для поиска нужных сообщений</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Поиск по тексту</label>
                      <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Поиск в сообщениях..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Канал</label>
                      <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все каналы</SelectItem>
                          {channels.map((channel) => (
                            <SelectItem key={channel} value={channel}>
                              {channel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ключевое слово</label>
                      <Select value={selectedKeyword} onValueChange={setSelectedKeyword}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все слова</SelectItem>
                          {keywords.map((keyword) => (
                            <SelectItem key={keyword} value={keyword}>
                              {keyword}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Тональность</label>
                      <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Любая</SelectItem>
                          <SelectItem value="positive">Позитивная</SelectItem>
                          <SelectItem value="neutral">Нейтральная</SelectItem>
                          <SelectItem value="negative">Негативная</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Дата от</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-transparent"
                          >
                            <IconCalendar className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Дата до</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-transparent"
                          >
                            <IconCalendar className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-end gap-2">
                      <Button onClick={applyFilters} className="flex-1">
                        Применить
                      </Button>
                      <Button variant="outline" onClick={resetFilters}>
                        Сбросить
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Найдено сообщений: {filteredMessages.length}</h3>
                </div>

                {filteredMessages.map((message) => (
                  <Card key={message.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{message.channel}</Badge>
                            <Badge variant="secondary">{message.keyword}</Badge>
                            {getSentimentBadge(message.sentiment)}
                          </div>
                          <CardDescription className="text-xs">{message.channelName}</CardDescription>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{message.timestamp}</div>
                          <div className="text-xs">ID: {message.messageId}</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4 leading-relaxed">{message.content}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>👁 {message.views.toLocaleString()}</span>
                          <span>↗ {message.forwards}</span>
                          <span>❤ {message.reactions}</span>
                        </div>
                        <Button variant="outline" size="sm">
                          <IconExternalLink className="mr-2 h-4 w-4" />
                          Открыть в Telegram
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredMessages.length === 0 && (
                  <Card className="text-center py-12">
                    <CardContent>
                      <IconMessage className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Сообщения не найдены</h3>
                      <p className="text-muted-foreground mb-4">
                        Попробуйте изменить параметры фильтрации или добавить новые каналы для мониторинга
                      </p>
                      <Button variant="outline" onClick={resetFilters}>
                        Сбросить фильтры
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
