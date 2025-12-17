"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"
import { TopVideosGrid } from "@/components/channel/TopVideosGrid"
import { ContentInsightsSection } from "@/components/channel/ContentInsightsSection"
import { MomentumInsightsSection } from "@/components/channel/MomentumInsightsSection"
import { AudienceInsightsSection } from "@/components/channel/AudienceInsightsSection"
import { CommentInsights } from "@/components/channel/CommentInsights"
import { DeepCommentAnalysisSection } from "@/components/channel/DeepCommentAnalysisSection"
import type { UserPlan } from "@/config/limits"

interface ChannelAnalyticsProps {
  competitorId: number
  channelId: string
  videos: any[]
  contentData: any
  momentumData: any
  audienceData: any
  commentsData: any
  deepAnalysisData: any
  hasVideos: boolean
  hasComments: boolean
  /** План пользователя для лимитов видео */
  userPlan?: UserPlan
}

/**
 * Обёртка для сворачиваемого раздела
 */
function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {isOpen && children}
    </Card>
  )
}

export function ChannelAnalytics({
  competitorId,
  channelId,
  videos,
  contentData,
  momentumData,
  audienceData,
  commentsData,
  deepAnalysisData,
  hasVideos,
  hasComments,
  userPlan = "free",
}: ChannelAnalyticsProps) {
  // Все разделы закрыты по умолчанию - пользователь видит полный обзор доступных аналитических блоков
  const [expanded, setExpanded] = useState({
    videos: false,
    content: false,
    momentum: false,
    audience: false,
    comments: false,
    deepAnalysis: false,
  })

  const toggle = (section: keyof typeof expanded) => {
    setExpanded(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">ИИ аналитика</h2>
        <p className="text-sm text-muted-foreground">
          Глубокие инсайты на основе искусственного интеллекта
        </p>
      </div>

      {/* Top Videos */}
      <CollapsibleSection
        title="Топ видео"
        isOpen={expanded.videos}
        onToggle={() => toggle("videos")}
      >
        <TopVideosGrid videos={videos} userPlan={userPlan} channelId={channelId} />
      </CollapsibleSection>

      {/* Content Intelligence */}
      <CollapsibleSection
        title="Аналитика контента"
        isOpen={expanded.content}
        onToggle={() => toggle("content")}
      >
        <ContentInsightsSection
          competitorId={competitorId}
          channelId={channelId}
          contentData={contentData}
          hasRequiredData={hasVideos}
        />
      </CollapsibleSection>

      {/* Анализ роста */}
      <CollapsibleSection
        title="Анализ роста"
        isOpen={expanded.momentum}
        onToggle={() => toggle("momentum")}
      >
        <MomentumInsightsSection
          competitorId={competitorId}
          momentumData={momentumData}
          channelId={channelId}
          hasRequiredData={hasVideos}
        />
      </CollapsibleSection>

      {/* Анализ аудитории */}
      <CollapsibleSection
        title="Аудитория и взаимодействие"
        isOpen={expanded.audience}
        onToggle={() => toggle("audience")}
      >
        <AudienceInsightsSection
          competitorId={competitorId}
          audienceData={audienceData}
          channelId={channelId}
          hasRequiredData={hasVideos}
        />
      </CollapsibleSection>

      {/* Анализ комментариев */}
      <CollapsibleSection
        title="Интеллект комментариев"
        isOpen={expanded.comments}
        onToggle={() => toggle("comments")}
      >
        <CommentInsights
          competitorId={competitorId}
          channelId={channelId}
          initialData={commentsData}
          hasRequiredData={hasVideos && hasComments}
        />
      </CollapsibleSection>

      {/* Deep Comment Analysis */}
      <CollapsibleSection
        title="Глубокий анализ комментариев"
        isOpen={expanded.deepAnalysis}
        onToggle={() => toggle("deepAnalysis")}
      >
        <DeepCommentAnalysisSection
          competitorId={competitorId}
          channelId={channelId}
          deepAnalysisData={deepAnalysisData}
          hasRequiredData={hasVideos && hasComments}
        />
      </CollapsibleSection>
    </div>
  )
}
