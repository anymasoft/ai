"use client"
import { useSession } from "next-auth/react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useScriptGenerationStore } from "@/store/scriptGenerationStore"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ExternalLink,
  TrendingUp,
  BarChart3,
  Calendar,
  Eye,
  Users,
  Loader2,
  FileText,
  ArrowRight,
  Video,
  RefreshCw,
  ChevronDown,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import Link from "next/link"
import type { MomentumVideo } from "@/lib/momentum-queries"
import type { GeneratedScript, SavedScript } from "@/types/scripts"
import type { UserPlan } from "@/config/limits"
import TrendingInsights from "./components/TrendingInsights"
import { formatChannelHandle, extractHandleFromUrl } from "@/lib/formatHandle"
import { formatMomentumPercent } from "@/lib/momentum-formatting"
import { ScriptLimitPaywall } from "@/components/script-limit-paywall"

type SortField = "momentumScore" | "viewsPerDay" | "viewCount" | "publishDate"
type SortDirection = "asc" | "desc"

// Пресеты температуры для генерации сценария
const SCRIPT_TEMPERATURE_PRESETS = [
  {
    key: "strict",
    label: "Более строгий",
    description: "Больше фактов, меньше креатива, более предсказуемая подача.",
    value: 0.4,
  },
  {
    key: "balanced",
    label: "Сбалансированный",
    description: "Оптимальный баланс между структурой и креативностью.",
    value: 0.7,
  },
  {
    key: "creative",
    label: "Максимальный креатив",
    description: "Более смелые, парадоксальные и художественные сценарии.",
    value: 1.0,
  },
] as const

type TemperatureKey = (typeof SCRIPT_TEMPERATURE_PRESETS)[number]["key"]

interface ChannelInfo {
  channelId: string
  channelTitle: string
  channelHandle?: string
}

export default function TrendingPage() {
  const { data: session } = useSession()
  const userPlan = (session?.user?.plan || "free") as UserPlan
  const [videos, setVideos] = useState<MomentumVideo[]>([])
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [sortField, setSortField] = useState<SortField>("momentumScore")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [momentumFilter, setMomentumFilter] = useState<string>("all")
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [generatedScripts, setGeneratedScripts] = useState<
    GeneratedScript[] | null
  >(null)
  const [savedScript, setSavedScript] = useState<SavedScript | null>(null)
  const router = useRouter()

  const {
    isGenerating: generatingScripts,
    start: startScriptGeneration,
    finish: finishScriptGeneration,
    setError: setScriptGenerationError,
  } = useScriptGenerationStore()

  // ВАЖНО: Zustand persist гидратируется асинхронно.
  // Чтобы при F5 не было "мигания" активной кнопки,
  // делаем локальный флаг hydration.
  const [isScriptGenHydrated, setIsScriptGenHydrated] = useState(false)

  useEffect(() => {
    // Zustand persist гидратируется асинхронно. Нам нужно дождаться hydrate,
    // чтобы корректно отрисовать disabled/loading после F5.
    //
    // На zustand store объекте доступны методы persist.
    try {
      // Если уже гидратирован — отмечаем сразу.
      if (
        (
          useScriptGenerationStore as unknown as {
            persist?: { hasHydrated?: () => boolean }
          }
        ).persist?.hasHydrated?.()
      ) {
        setIsScriptGenHydrated(true)
        return
      }

      // Подписываемся на завершение гидратации.
      const unsub = (
        useScriptGenerationStore as unknown as {
          persist?: {
            onFinishHydration?: (cb: () => void) => (() => void) | void
          }
        }
      ).persist?.onFinishHydration?.(() => {
        setIsScriptGenHydrated(true)
      })

      return () => {
        if (typeof unsub === "function") unsub()
      }
    } catch {
      // Если persist API недоступен — не блокируем UI.
      setIsScriptGenHydrated(true)
      return
    }
  }, [])

  const [generationError, setGenerationError] = useState<string | null>(null)
  const [selectedTemperatureKey, setSelectedTemperatureKey] =
    useState<TemperatureKey>("balanced")
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [videosCooldownUntil, setVideosCooldownUntil] = useState<number | null>(
    null
  )
  const VIDEOS_COOLDOWN_MS = 86400000 // TODO: заменить на значение из API meta.cooldown.nextAllowedAt
  const [scriptSourceMode, setScriptSourceMode] = useState<
    "trending" | "specific"
  >("trending")
  const [specificVideoUrl, setSpecificVideoUrl] = useState<string>("")
  const [monthlyRemaining, setMonthlyRemaining] = useState<number>(0)
  const [isPaywallOpen, setIsPaywallOpen] = useState(false)

  const getVideosCooldownTimeRemaining = () => {
    if (!videosCooldownUntil) return null
    const remaining = videosCooldownUntil - Date.now()
    if (remaining <= 0) {
      setVideosCooldownUntil(null)
      return null
    }
    const hours = Math.floor(remaining / 3600000)
    const minutes = Math.floor((remaining % 3600000) / 60000)
    return { hours, minutes }
  }

  const isVideosCooldownActive =
    videosCooldownUntil && Date.now() < videosCooldownUntil

  const refreshDate = async (videoId: string) => {
    setRefreshingId(videoId)
    try {
      const res = await fetch(`/api/video/${videoId}/refresh-date`, {
        method: "POST",
      })
      const result = await res.json()
      if (result.success && result.publishDate) {
        setVideos((prev) =>
          prev.map((v) =>
            v.videoId === videoId
              ? { ...v, publishDate: result.publishDate }
              : v
          )
        )
      }
    } catch (err) {
      console.error("Ошибка обновления даты:", err)
    } finally {
      setRefreshingId(null)
    }
  }

  const fetchMomentumVideos = useCallback(async () => {
    try {
      console.log("Fetching momentum videos...")
      // Принудительно сбрасываем состояние загрузки
      setLoading(true)
      setError(null)

      // Добавляем timestamp для предотвращения кэширования
      const timestamp = Date.now()
      const response = await fetch(
        `/api/competitors/momentum/all?limit=${limit}&_=${timestamp}`
      )

      console.log("Response status:", response.status)
      const data = await response.json()
      console.log("Response data:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch momentum videos")
      }

      if (data.success) {
        console.log(
          `Successfully fetched ${data.items?.length || 0} videos and ${data.channels?.length || 0} channels`
        )
        setVideos(data.items || [])
        setVideosCooldownUntil(Date.now() + VIDEOS_COOLDOWN_MS)
        setChannels(data.channels || [])
        // Сбрасываем выбранные видео и сценарии при обновлении
        setSelectedVideos(new Set())
        setGeneratedScripts(null)
        setSavedScript(null)
        setGenerationError(null)
      } else {
        throw new Error(data.error || "Failed to fetch momentum videos")
      }
    } catch (err) {
      console.error("Error fetching momentum videos:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      // Гарантированно сбрасываем состояние загрузки
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchMomentumVideos()
  }, [limit, fetchMomentumVideos])

  // Получаем информацию об использовании сценариев
  useEffect(() => {
    const fetchScriptUsage = async () => {
      try {
        const response = await fetch("/api/billing/script-usage")
        if (response.ok) {
          const data = await response.json()
          setMonthlyRemaining(data.monthlyRemaining || 0)
        }
      } catch (err) {
        console.error("[TrendingPage] Ошибка при получении usage:", err)
      }
    }

    if (session?.user?.id) {
      fetchScriptUsage()
    }
  }, [session?.user?.id])

  // Авто-сброс persisted loading, если генерация зависла (например, после F5)
  useEffect(() => {
    useScriptGenerationStore.getState().ensureNotStale()
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  // Получаем каналы для фильтра
  const uniqueChannels = channels.map((channel) => {
    // Извлекаем handle из channelHandle (может быть URL)
    let handleOrId = channel.channelId
    if (channel.channelHandle) {
      if (channel.channelHandle.startsWith("@")) {
        // Уже правильный handle
        handleOrId = channel.channelHandle
      } else if (
        channel.channelHandle.includes("youtube.com") ||
        channel.channelHandle.includes("http")
      ) {
        // Это URL, извлекаем handle
        const extracted = extractHandleFromUrl(channel.channelHandle)
        handleOrId = extracted || channel.channelId
      } else {
        // Простой handle, добавляем @
        handleOrId = `@${channel.channelHandle}`
      }
    }

    return {
      title: channel.channelTitle,
      handleOrId,
      displayName: formatChannelHandle(channel),
    }
  })

  // Обработчики для чекбоксов
  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
    // Сбрасываем сценарии при изменении выбора видео
    if (generatedScripts || savedScript) {
      setGeneratedScripts(null)
      setSavedScript(null)
      setGenerationError(null)
    }
  }

  const toggleSelectAll = () => {
    if (selectedVideos.size === filteredVideos.length) {
      // Если все уже выбраны - снимаем выделение
      setSelectedVideos(new Set())
    } else {
      // Выбираем все отфильтрованные видео
      const allVideoIds = new Set(filteredVideos.map((v) => v.videoId))
      setSelectedVideos(allVideoIds)
    }
    // Сбрасываем сценарии при изменении выбора видео
    if (generatedScripts || savedScript) {
      setGeneratedScripts(null)
      setSavedScript(null)
      setGenerationError(null)
    }
  }

  // Фильтруем видео
  const filteredVideos = videos.filter((video) => {
    // Фильтр по каналу
    if (channelFilter !== "all") {
      const [, selectedHandleOrId] = channelFilter.split("|")
      if (selectedHandleOrId?.startsWith("@")) {
        // Фильтр по handle
        if (video.channelHandle !== selectedHandleOrId.slice(1)) {
          return false
        }
      } else {
        // Фильтр по channelId
        if (video.channelId !== selectedHandleOrId) {
          return false
        }
      }
    }

    // Фильтр по типу momentum
    if (momentumFilter !== "all") {
      switch (momentumFilter) {
        case "high":
          if (!video.category || video.category !== "High Momentum")
            return false
          break
        case "rising":
          if (!video.category || video.category !== "Rising") return false
          break
        case "normal":
          if (!video.category || video.category !== "Normal") return false
          break
        case "underperforming":
          if (!video.category || video.category !== "Underperforming")
            return false
          break
      }
    }

    return true
  })

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M"
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K"
    }
    return num.toString()
  }

  // Используем новый хелпер formatMomentumPercent из @/lib/momentum-formatting
  // Он обрабатывает edge cases и clamp'ит абсурдные значения

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case "High Momentum":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            🔥 Высокий рост
          </Badge>
        )
      case "Rising":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            📈 Растёт
          </Badge>
        )
      case "Underperforming":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            📉 Проседает
          </Badge>
        )
      default:
        return <Badge variant="outline">Обычный</Badge>
    }
  }

  // Функция для генерации сценариев
  const generateScripts = async () => {
    // Проверяем лимит сценариев
    if (monthlyRemaining === 0) {
      setIsPaywallOpen(true)
      return
    }

    // Валидация в зависимости от режима
    if (scriptSourceMode === "trending") {
      if (selectedVideos.size === 0) {
        setGenerationError("Выберите хотя бы одно видео для генерации сценария")
        return
      }
    } else if (scriptSourceMode === "specific") {
      if (!specificVideoUrl.trim()) {
        setGenerationError("Введите ссылку на YouTube-видео")
        return
      }
    }

    startScriptGeneration(
      scriptSourceMode === "trending" ? "trending" : "youtube"
    )
    setGenerationError(null)
    setGeneratedScripts(null)
    setSavedScript(null)

    // Получаем значение температуры из выбранного пресета
    const selectedPreset =
      SCRIPT_TEMPERATURE_PRESETS.find(
        (p) => p.key === selectedTemperatureKey
      ) ?? SCRIPT_TEMPERATURE_PRESETS[1] // balanced по умолчанию
    const temperature = selectedPreset.value

    try {
      const requestBody =
        scriptSourceMode === "trending"
          ? {
              sourceMode: "trending",
              selectedVideoIds: Array.from(selectedVideos),
              temperature,
            }
          : {
              sourceMode: "youtube",
              youtubeUrl: specificVideoUrl.trim(),
              temperature,
            }

      const response = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate scripts")
      }

      // Новый API возвращает один сохранённый сценарий
      if (data.script) {
        setSavedScript(data.script)
        // Очищаем выбранные видео и URL после успешной генерации
        setSelectedVideos(new Set())
        setSpecificVideoUrl("")
        console.log(
          `Successfully generated and saved script: ${data.script.title}`
        )

        // Обновляем usage сразу после успешной генерации
        try {
          const usageRes = await fetch("/api/billing/script-usage", {
            cache: "no-store",
          })
          if (usageRes.ok) {
            const usageData = await usageRes.json()
            setMonthlyRemaining(usageData.monthlyRemaining || 0)
            console.log(
              `[TrendingPage] Usage обновлено: monthlyRemaining=${usageData.monthlyRemaining}`
            )
          }
        } catch (usageErr) {
          console.error("[TrendingPage] Ошибка при обновлении usage:", usageErr)
        }
      } else if (data.scripts) {
        // Старый формат ответа (для обратной совместимости)
        setGeneratedScripts(data.scripts || [])
        console.log(
          `Successfully generated ${data.scripts?.length || 0} scripts`
        )
      }
    } catch (err) {
      console.error("Error generating scripts:", err)
      const msg = err instanceof Error ? err.message : "Unknown error"
      setGenerationError(msg)
      setScriptGenerationError(msg)
    } finally {
      finishScriptGeneration()
    }
  }

  if (loading && videos.length === 0) {
    return (
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Тренды конкурентов</h1>
          <p className="text-muted-foreground">
            Самые быстрорастущие видео среди ваших конкурентов
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка видео...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && videos.length === 0) {
    return (
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Тренды конкурентов</h1>
          <p className="text-muted-foreground">
            Самые быстрорастущие видео среди ваших конкурентов
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-2">Ошибка загрузки видео</p>
              <p className="text-muted-foreground text-sm mb-4">{error}</p>
              <Button onClick={fetchMomentumVideos}>Попробовать снова</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6">
      {/* AI Insights Block - Collapsible */}
      <div className="mb-6">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ChevronDown className="h-5 w-5 transition-transform duration-200" />
              <h2 className="text-lg font-semibold">AI-анализ трендов</h2>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <TrendingInsights videos={videos} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Тренды конкурентов</h1>
        <p className="text-muted-foreground mt-1">
          Самые быстрорастущие видео среди ваших конкурентов
        </p>
      </div>

      {/* Блок генерации сценария */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Сгенерировать сценарий</CardTitle>
          <CardDescription>Основной инструмент для создания скриптов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Источник для генерации сценария */}
          <div className="pb-6 border-b">
            <h4 className="font-medium mb-3">Источник для генерации сценария</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    id="scriptSourceTrending"
                    name="scriptSource"
                    value="trending"
                    checked={scriptSourceMode === "trending"}
                    onChange={() => {
                      setScriptSourceMode("trending")
                    }}
                    disabled={false}
                    className="h-4 w-4"
                  />
                </div>
                <Label
                  htmlFor="scriptSourceTrending"
                  className="flex-1 cursor-pointer"
                >
                  Использовать выбранные трендовые видео
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    id="scriptSourceSpecific"
                    name="scriptSource"
                    value="specific"
                    checked={scriptSourceMode === "specific"}
                    onChange={() => {
                      setScriptSourceMode("specific")
                    }}
                    disabled={false}
                    className="h-4 w-4"
                  />
                </div>
                <Label
                  htmlFor="scriptSourceSpecific"
                  className="flex-1 cursor-pointer"
                >
                  Использовать конкретное YouTube-видео
                </Label>
              </div>
            </div>
            <div className="mt-3 ml-7">
              <Input
                type="text"
                placeholder="Вставьте ссылку на YouTube-видео"
                disabled={scriptSourceMode === "trending"}
                value={specificVideoUrl}
                onChange={(e) => setSpecificVideoUrl(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Мы проанализируем структуру видео, хуки и подачу,
                <br />
                чтобы создать оригинальный сценарий в похожем стиле.
              </p>
            </div>
          </div>

          {/* Селектор креативности */}
          <div>
            <h4 className="font-medium mb-1">Креативность сценария</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Настройте баланс между строгой структурой и смелыми идеями.
            </p>
            <div className="flex flex-col md:flex-row gap-2">
              {SCRIPT_TEMPERATURE_PRESETS.map((preset) => (
                <label
                  key={preset.key}
                  className={`flex-1 flex items-start gap-2 p-3 rounded-md border transition-colors cursor-pointer ${
                    selectedTemperatureKey === preset.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="scriptTemperature"
                    value={preset.key}
                    checked={selectedTemperatureKey === preset.key}
                    onChange={() => {
                      setSelectedTemperatureKey(preset.key)
                    }}
                    disabled={false}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-sm">{preset.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {preset.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Кнопка генерации */}
          <div className="flex justify-end">
            {monthlyRemaining === 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/settings/billing")}
                    className="gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    {userPlan === "free" ? "Выбрать тариф" : "Увеличить лимит"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Лимит сценариев исчерпан. Выберите тариф, чтобы продолжить.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={generateScripts}
                variant="default"
                disabled={
                  !isScriptGenHydrated ||
                  (scriptSourceMode === "trending" &&
                    selectedVideos.size === 0) ||
                  (scriptSourceMode === "specific" && !specificVideoUrl.trim()) ||
                  generatingScripts
                }
                className="gap-2 cursor-pointer"
              >
                {generatingScripts ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    {scriptSourceMode === "trending"
                      ? `Сгенерировать сценарий (${selectedVideos.size})`
                      : "Сгенерировать сценарий"}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Фильтры и контролы */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Группа фильтров */}
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
              {/* Фильтр по каналу */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Фильтр по каналу:
                </span>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Все каналы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все каналы</SelectItem>
                    {uniqueChannels.map((channel) => (
                      <SelectItem
                        key={channel.handleOrId}
                        value={`${channel.title}|${channel.handleOrId}`}
                      >
                        {channel.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Фильтр по типу momentum */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Тип momentum:
                </span>
                <Select
                  value={momentumFilter}
                  onValueChange={setMomentumFilter}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Все типы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="high">Высокий рост</SelectItem>
                    <SelectItem value="rising">Растёт</SelectItem>
                    <SelectItem value="normal">Обычный</SelectItem>
                    <SelectItem value="underperforming">Проседает</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Селектор количества видео */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Показывать:
                </span>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => setLimit(parseInt(value, 10))}
                >
                  <SelectTrigger className="w-full sm:w-28">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 видео</SelectItem>
                    <SelectItem value="20">20 видео</SelectItem>
                    <SelectItem value="50">50 видео</SelectItem>
                    <SelectItem value="100">100 видео</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Кнопка обновления */}
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      console.log("Обновить button clicked!")
                      fetchMomentumVideos()
                    }}
                    disabled={loading}
                    className="cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Обновить видео
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

      {videos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Видео не найдены</CardTitle>
            <CardDescription>
              Добавьте конкурентов и синхронизируйте данные, чтобы увидеть тренды
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Этот раздел показывает самые быстрорастущие видео среди ваших
              конкурентов. Чтобы начать:
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
              <li>Добавьте конкурентов</li>
              <li>Синхронизируйте их видео и метрики</li>
              <li>Дождитесь расчёта momentum</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Или вы можете сгенерировать сценарий по ссылке на YouTube-видео
              ниже, даже без добавления конкурентов.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Топ видео по momentum</CardTitle>
            <CardDescription>
              Показано {sortedVideos.length} из {filteredVideos.length} видео
              (всего {videos.length}). Сортировка по {sortField} (
              {sortDirection})
              {channelFilter !== "all" &&
                ` • Фильтр: ${channelFilter.split("|")[0]}`}
              {momentumFilter !== "all" && ` • Тип: ${momentumFilter}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scriptSourceMode === "specific" && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  Выбор трендовых видео недоступен при использовании ссылки на
                  видео
                </p>
              </div>
            )}
            <div
              className={
                scriptSourceMode === "specific"
                  ? "opacity-50 pointer-events-none"
                  : ""
              }
            >
              <Table style={{ tableLayout: "fixed" }}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <input
                        type="checkbox"
                        checked={
                          selectedVideos.size === filteredVideos.length &&
                          filteredVideos.length > 0
                        }
                        onChange={toggleSelectAll}
                        disabled={scriptSourceMode === "specific"}
                        className={`h-4 w-4 rounded border-gray-300 ${scriptSourceMode === "specific" ? "opacity-50 cursor-not-allowed" : ""}`}
                        title="Выбрать все"
                      />
                    </TableHead>
                    <TableHead className="w-[300px]">
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-medium"
                        onClick={() => handleSort("publishDate")}
                      >
                        Видео
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-medium"
                        onClick={() => handleSort("momentumScore")}
                      >
                        <TrendingUp className="h-4 w-4 mr-2 inline" />
                        Momentum
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-medium"
                        onClick={() => handleSort("viewsPerDay")}
                      >
                        <BarChart3 className="h-4 w-4 mr-2 inline" />
                        Просмотров/день
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-medium"
                        onClick={() => handleSort("viewCount")}
                      >
                        <Eye className="h-4 w-4 mr-2 inline" />
                        Всего просмотров
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-medium"
                      >
                        <Calendar className="h-4 w-4 mr-2 inline" />
                        Дата
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-medium"
                      >
                        <Users className="h-4 w-4 mr-2 inline" />
                        Канал
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVideos.map((video) => (
                    <TableRow key={video.videoId}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedVideos.has(video.videoId)}
                          onChange={() => toggleVideoSelection(video.videoId)}
                          disabled={scriptSourceMode === "specific"}
                          className={`h-4 w-4 rounded border-gray-300 ${scriptSourceMode === "specific" ? "opacity-50 cursor-not-allowed" : ""}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <a
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium hover:text-primary hover:underline block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap"
                                title={video.title}
                              >
                                {video.title}
                              </a>
                              <div className="flex items-center gap-2 mt-1">
                                {getCategoryBadge(video.category)}
                                <a
                                  href={video.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div
                            className={`text-lg font-bold ${
                              video.momentumScore > 0.5
                                ? "text-green-600"
                                : video.momentumScore > 0.1
                                  ? "text-blue-600"
                                  : video.momentumScore < -0.3
                                    ? "text-red-600"
                                    : "text-foreground"
                            }`}
                          >
                            {formatMomentumPercent(video.momentumScore)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            к медиане
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {formatNumber(Math.round(video.viewsPerDay))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            в день
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {formatNumber(video.viewCount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            всего
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {video.publishDate ? (
                          <div className="space-y-1">
                            <div className="font-medium">
                              {formatDistanceToNow(video.publishDate, {
                                addSuffix: true,
                                locale: ru,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(video.publishDate).toLocaleDateString(
                                "ru-RU"
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => refreshDate(video.videoId)}
                            disabled={refreshingId === video.videoId}
                            title="Обновить дату"
                            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${refreshingId === video.videoId ? "animate-spin" : ""}`}
                            />
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div
                            className="font-medium"
                            title={video.channelTitle}
                          >
                            <a
                              href={`https://www.youtube.com/${video.channelHandle ? `@${video.channelHandle}` : `channel/${video.channelId}`}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline block max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap"
                            >
                              {video.channelTitle}
                            </a>
                          </div>
                          {video.channelHandle ? (
                            <div className="text-xs text-muted-foreground max-w-[220px] truncate">
                              {formatChannelHandle(video)}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              <a
                                href={`https://www.youtube.com/channel/${video.channelId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground"
                                title="Открыть канал"
                              >
                                <ExternalLink className="h-3 w-3 inline" />
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Momentum Score</strong> показывает, насколько быстрее
                  видео растёт по сравнению с медианным видео. Положительные
                  значения указывают на рост выше среднего, отрицательные — ниже
                  среднего.
                </p>
                <p className="mt-1">
                  <strong>Просмотров/день</strong> рассчитывается как общее
                  количество просмотров, делённое на дни с момента публикации.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Отображение ошибок генерации */}
      {generationError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 font-medium">
            Ошибка генерации сценариев:
          </p>
          <p className="text-red-600 text-sm mt-1">{generationError}</p>
        </div>
      )}

      {/* Отображение сохранённого сценария */}
      {savedScript && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">
              Сценарий успешно создан и сохранён!
            </h3>
            <Link href={`/scripts/${savedScript.id}`}>
              <Button className="gap-2">
                <FileText className="h-4 w-4" />
                Открыть сценарий
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <Card className="border border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-lg">{savedScript.title}</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {savedScript.hook}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  ID: {savedScript.id.substring(0, 8)}...
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Создан:{" "}
                  {new Date(savedScript.createdAt * 1000).toLocaleDateString(
                    "ru-RU"
                  )}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Video className="h-3 w-3" />
                  Видео: {savedScript.sourceVideos.length}
                </Badge>
              </div>
              <div>
                <h4 className="font-medium mb-2">Структура сценария:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {savedScript.outline.slice(0, 3).map((item, i) => (
                    <li key={i} className="text-sm">
                      {item}
                    </li>
                  ))}
                  {savedScript.outline.length > 3 && (
                    <li className="text-sm text-muted-foreground">
                      ... и ещё {savedScript.outline.length - 3} пунктов
                    </li>
                  )}
                </ul>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  Сценарий сохранён в вашу историю. Вы можете открыть его для
                  просмотра полного текста, копирования или создания новых
                  сценариев.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Отображение сгенерированных сценариев (старый формат для обратной совместимости) */}
      {generatedScripts && generatedScripts.length > 0 && !savedScript && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Сгенерированные сценарии</h3>
          <div className="space-y-6">
            {generatedScripts.map((script, index) => (
              <Card key={index} className="border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg">{script.title}</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    {script.hook}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Структура сценария:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {script.outline.map((item, i) => (
                        <li key={i} className="text-sm">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Текст сценария:</h4>
                    <div className="bg-gray-50 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {script.scriptText}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">
                      Почему это должно выстрелить:
                    </h4>
                    <p className="text-sm">{script.whyItShouldWork}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Paywall для исчерпания лимита сценариев */}
      <ScriptLimitPaywall
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
      />
    </div>
  )
}
