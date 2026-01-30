"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconMessage,
  IconUsers,
  IconEye,
  IconEyeOff,
  IconKey,
  IconBrandTelegram,
  IconMail,
  IconWebhook,
} from "@tabler/icons-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Channel {
  id: string
  name: string
  username: string
  description: string
  status: "active" | "inactive" | "error"
  subscribers: number
  lastActivity: string
  messagesCount: number
  keywordsMatched: number
  isMonitoring: boolean
  keywords: string[]
  notifications: {
    telegram: boolean
    email: boolean
    webhook: boolean
    frequency: "instant" | "hourly" | "daily"
    priority: "high" | "medium" | "low"
  }
}

const channelsData: Channel[] = [
  {
    id: "1",
    name: "Технологические новости",
    username: "@tech_news_ru",
    description: "Канал о последних новостях в мире технологий и IT",
    status: "active",
    subscribers: 45230,
    lastActivity: "2024-01-07 15:30",
    messagesCount: 1247,
    keywordsMatched: 89,
    isMonitoring: true,
    keywords: ["технологии", "AI", "машинное обучение", "стартап", "инновации"],
    notifications: {
      telegram: true,
      email: false,
      webhook: false,
      frequency: "instant",
      priority: "high"
    }
  },
  {
    id: "2",
    name: "Стартап дайджест",
    username: "@startup_digest",
    description: "Новости стартапов и инвестиций",
    status: "active",
    subscribers: 23450,
    lastActivity: "2024-01-07 14:15",
    messagesCount: 856,
    keywordsMatched: 67,
    isMonitoring: true,
    keywords: ["стартап", "инвестиции", "венчурный капитал", "IPO"],
    notifications: {
      telegram: true,
      email: true,
      webhook: false,
      frequency: "hourly",
      priority: "medium"
    }
  },
  {
    id: "3",
    name: "Криптоаналитика",
    username: "@crypto_analytics",
    description: "Аналитика и новости криптовалютного рынка",
    status: "inactive",
    subscribers: 18900,
    lastActivity: "2024-01-06 09:20",
    messagesCount: 432,
    keywordsMatched: 23,
    isMonitoring: false,
    keywords: ["биткоин", "эфириум", "DeFi", "NFT", "блокчейн"],
    notifications: {
      telegram: false,
      email: false,
      webhook: false,
      frequency: "daily",
      priority: "low"
    }
  },
  {
    id: "4",
    name: "Рыночные новости",
    username: "@market_news",
    description: "Обзоры и анализ финансовых рынков",
    status: "error",
    subscribers: 12340,
    lastActivity: "2024-01-05 18:45",
    messagesCount: 234,
    keywordsMatched: 12,
    isMonitoring: true,
    keywords: ["акции", "рынок", "экономика", "ФРС"],
    notifications: {
      telegram: true,
      email: false,
      webhook: true,
      frequency: "instant",
      priority: "high"
    }
  },
]

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>(channelsData)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [keywordDialogChannel, setKeywordDialogChannel] = useState<Channel | null>(null)
  const [newKeyword, setNewKeyword] = useState("")
  const [newChannel, setNewChannel] = useState({
    name: "",
    username: "",
    description: "",
  })

  const handleAddChannel = () => {
    const channel: Channel = {
      id: Date.now().toString(),
      name: newChannel.name,
      username: newChannel.username,
      description: newChannel.description,
      status: "active",
      subscribers: 0,
      lastActivity: new Date().toISOString().slice(0, 16).replace("T", " "),
      messagesCount: 0,
      keywordsMatched: 0,
      isMonitoring: true,
      keywords: [],
      notifications: {
        telegram: true,
        email: false,
        webhook: false,
        frequency: "instant",
        priority: "medium"
      }
    }
    setChannels([...channels, channel])
    setNewChannel({ name: "", username: "", description: "" })
    setIsAddDialogOpen(false)
  }

  const handleAddKeyword = (channelId: string) => {
    if (!newKeyword.trim()) return

    console.log('Добавление ключевого слова:', newKeyword.trim(), 'в канал:', channelId)
    
    // Обновляем состояние каналов
    const updatedChannels = channels.map((channel) =>
      channel.id === channelId ? { ...channel, keywords: [...channel.keywords, newKeyword.trim()] } : channel,
    )
    setChannels(updatedChannels)
    setNewKeyword("")
    
    // Если открыт диалог ключевых слов для этого канала, обновляем и его
    if (keywordDialogChannel && keywordDialogChannel.id === channelId) {
      const updatedChannel = updatedChannels.find(ch => ch.id === channelId)
      if (updatedChannel) {
        setKeywordDialogChannel(updatedChannel)
      }
    }
  }

  const handleRemoveKeyword = (channelId: string, keywordToRemove: string) => {
    console.log('Удаление ключевого слова:', keywordToRemove, 'из канала:', channelId)
    
    // Обновляем состояние каналов
    const updatedChannels = channels.map((channel) =>
      channel.id === channelId
        ? { ...channel, keywords: channel.keywords.filter((keyword) => keyword !== keywordToRemove) }
        : channel,
    )
    setChannels(updatedChannels)
    
    // Если открыт диалог ключевых слов для этого канала, обновляем и его
    if (keywordDialogChannel && keywordDialogChannel.id === channelId) {
      const updatedChannel = updatedChannels.find(ch => ch.id === channelId)
      if (updatedChannel) {
        setKeywordDialogChannel(updatedChannel)
      }
    }
  }

  const handleToggleMonitoring = (id: string) => {
    setChannels(
      channels.map((channel) =>
        channel.id === id
          ? { ...channel, isMonitoring: !channel.isMonitoring, status: !channel.isMonitoring ? "active" : "inactive" }
          : channel,
      ),
    )
  }

  const handleDeleteChannel = (id: string) => {
    setChannels(channels.filter((channel) => channel.id !== id))
  }

  const handleEditChannel = () => {
    if (!editingChannel) {
      console.log('Нет канала для редактирования')
      return
    }

    console.log('Сохранение изменений канала:', editingChannel)
    setChannels(channels.map((channel) => (channel.id === editingChannel.id ? editingChannel : channel)))
    setEditingChannel(null)
    console.log('Диалог редактирования закрыт')
  }

  const getStatusBadge = (status: Channel["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Активен</Badge>
      case "inactive":
        return <Badge variant="secondary">Неактивен</Badge>
      case "error":
        return <Badge variant="destructive">Ошибка</Badge>
    }
  }

  return (
    <>
      {/* Модальный диалог редактирования - ВНЕ всех компонентов */}
      {editingChannel ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-lg font-semibold mb-2">Редактировать канал</h2>
            <p className="text-sm text-gray-600 mb-4">Измените username канала "{editingChannel?.name}"</p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-channel-username" className="block text-sm font-medium mb-1">
                  Username канала
                </label>
                <input
                  id="edit-channel-username"
                  className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={editingChannel?.username || ""}
                  onChange={(e) =>
                    setEditingChannel(editingChannel ? { ...editingChannel, username: e.target.value } : null)
                  }
                  placeholder="@channel_name"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button 
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => setEditingChannel(null)}
              >
                Отмена
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                onClick={handleEditChannel}
              >
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Основной контент */}
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="@container/main">
              <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Мониторинг каналов</h1>
                  <p className="text-muted-foreground">Управление Telegram каналами, ключевыми словами и уведомлениями</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <IconPlus className="mr-2 h-4 w-4" />
                      Добавить канал
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="z-[100]">
                    <DialogHeader>
                      <DialogTitle>Добавить новый канал</DialogTitle>
                      <DialogDescription>Введите данные Telegram канала для добавления в мониторинг</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="channel-name">Название канала</Label>
                        <Input
                          id="channel-name"
                          value={newChannel.name}
                          onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                          placeholder="Введите название канала"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="channel-username">Username канала</Label>
                        <Input
                          id="channel-username"
                          value={newChannel.username}
                          onChange={(e) => setNewChannel({ ...newChannel, username: e.target.value })}
                          placeholder="@channel_name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="channel-description">Описание</Label>
                        <Textarea
                          id="channel-description"
                          value={newChannel.description}
                          onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                          placeholder="Краткое описание канала"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button onClick={handleAddChannel}>Добавить канал</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {channels.map((channel) => (
                  <Card key={channel.id} className="relative w-full max-w-sm mx-auto">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{channel.name}</CardTitle>
                          <CardDescription className="text-sm font-mono">{channel.username}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(channel.status)}
                          
                          {/* Кнопка редактирования ключевых слов */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setKeywordDialogChannel(channel)}
                            title="Управление ключевыми словами"
                          >
                            <IconKey className="h-4 w-4" />
                          </Button>
                          
                          {/* Кнопка редактирования канала */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingChannel(channel)}
                            title="Редактировать канал"
                          >
                            <IconEdit className="h-4 w-4" />
                          </Button>
                          
                          {/* Кнопка удаления канала */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteChannel(channel.id)}
                            title="Удалить канал"
                            className="text-red-600 hover:text-red-700"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">{channel.description}</p>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <IconUsers className="h-4 w-4 text-muted-foreground" />
                          <span>{channel.subscribers.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <IconMessage className="h-4 w-4 text-muted-foreground" />
                          <span>{channel.messagesCount}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Ключевые слова:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setKeywordDialogChannel(channel)}
                            className="h-6 px-2 text-xs"
                          >
                            <IconKey className="h-3 w-3 mr-1" />
                            Управление
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {channel.keywords.length > 0 ? (
                            channel.keywords.slice(0, 3).map((keyword, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Не настроены</span>
                          )}
                          {channel.keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{channel.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Совпадений:</span>
                          <Badge variant="outline">{channel.keywordsMatched}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Последняя активность:</span>
                          <span className="text-xs">{channel.lastActivity}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          {channel.isMonitoring ? (
                            <IconEye className="h-4 w-4 text-green-600" />
                          ) : (
                            <IconEyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">Мониторинг</span>
                        </div>
                        <Switch
                          checked={channel.isMonitoring}
                          onCheckedChange={() => handleToggleMonitoring(channel.id)}
                        />
                      </div>

                      {/* Настройки уведомлений */}
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Уведомления:</span>
                          <Badge variant="outline" className="text-xs">
                            {channel.notifications.frequency === 'instant' ? 'Мгновенно' : 
                             channel.notifications.frequency === 'hourly' ? 'Каждый час' : 'Ежедневно'}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            {channel.notifications.telegram ? (
                              <IconBrandTelegram className="h-3 w-3 text-blue-500" />
                            ) : (
                              <IconBrandTelegram className="h-3 w-3 text-gray-400" />
                            )}
                            <span>Telegram</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {channel.notifications.email ? (
                              <IconMail className="h-3 w-3 text-blue-500" />
                            ) : (
                              <IconMail className="h-3 w-3 text-gray-400" />
                            )}
                            <span>Email</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {channel.notifications.webhook ? (
                              <IconWebhook className="h-3 w-3 text-blue-500" />
                            ) : (
                              <IconWebhook className="h-3 w-3 text-gray-400" />
                            )}
                            <span>Webhook</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Приоритет:</span>
                          <Badge variant={
                            channel.notifications.priority === 'high' ? 'destructive' : 
                            channel.notifications.priority === 'medium' ? 'default' : 'secondary'
                          } className="text-xs">
                            {channel.notifications.priority === 'high' ? 'Высокий' : 
                             channel.notifications.priority === 'medium' ? 'Средний' : 'Низкий'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Dialog open={!!keywordDialogChannel} onOpenChange={() => setKeywordDialogChannel(null)}>
                <DialogContent className="max-w-md z-[100]">
                  <DialogHeader>
                    <DialogTitle>Ключевые слова</DialogTitle>
                    <DialogDescription>
                      Управление ключевыми словами для канала "{keywordDialogChannel?.name}"
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Добавить ключевое слово"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && keywordDialogChannel) {
                            handleAddKeyword(keywordDialogChannel.id)
                          }
                        }}
                      />
                      <Button
                        onClick={() => keywordDialogChannel && handleAddKeyword(keywordDialogChannel.id)}
                        disabled={!newKeyword.trim()}
                      >
                        <IconPlus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {keywordDialogChannel?.keywords.map((keyword, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <span className="text-sm">{keyword}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              keywordDialogChannel && handleRemoveKeyword(keywordDialogChannel.id, keyword)
                            }
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {keywordDialogChannel?.keywords.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Ключевые слова не добавлены</p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setKeywordDialogChannel(null)}>
                      Закрыть
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {channels.length === 0 && (
                <Card className="text-center py-12">
                  <CardContent>
                    <IconMessage className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Нет добавленных каналов</h3>
                    <p className="text-muted-foreground mb-4">Добавьте первый Telegram канал для начала мониторинга</p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <IconPlus className="mr-2 h-4 w-4" />
                      Добавить канал
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </>
  )
}
