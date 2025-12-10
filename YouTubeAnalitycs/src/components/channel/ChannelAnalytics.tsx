"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ChannelMetricsSection } from "@/components/channel/ChannelMetricsSection"
import { TopVideosGrid } from "@/components/channel/TopVideosGrid"
import { ContentIntelligenceBlock } from "@/components/channel/ContentIntelligenceBlock"
import { MomentumInsights } from "@/components/channel/MomentumInsights"
import { AudienceInsightsSection } from "@/components/channel/AudienceInsightsSection"
import { CommentInsights } from "@/components/channel/CommentInsights"
import { DeepCommentAnalysis } from "@/components/channel/DeepCommentAnalysis"
import type { UserPlan } from "@/config/limits"

interface ChannelAnalyticsProps {
  channelId: number
  metrics: any[]
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
  /** Нажал ли пользователь "Получить метрики" */
  hasShownMetrics?: boolean
  /** Нажал ли пользователь "Получить аудиторию" */
  hasShownAudience?: boolean
  /** Нажал ли пользователь "Получить топ-видео" */
  hasShownVideos?: boolean
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
  channelId,
  metrics,
  videos,
  contentData,
  momentumData,
  audienceData,
  commentsData,
  deepAnalysisData,
  hasVideos,
  hasComments,
  userPlan = "free",
  hasShownMetrics = false,
  hasShownAudience = false,
  hasShownVideos = false,
}: ChannelAnalyticsProps) {
  // Все разделы закрыты по умолчанию - пользователь видит полный обзор доступных аналитических блоков
  const [expanded, setExpanded] = useState({
    growth: false,
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
        <h2 className="text-xl font-semibold">AI Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Deep insights powered by artificial intelligence
        </p>
      </div>

      {/* Growth Chart */}
      <CollapsibleSection
        title="Growth Over Time"
        isOpen={expanded.growth}
        onToggle={() => toggle("growth")}
      >
        <ChannelMetricsSection metrics={metrics} hasShownMetrics={hasShownMetrics} channelId={channelId} />
      </CollapsibleSection>

      {/* Top Videos */}
      <CollapsibleSection
        title="Top Videos"
        isOpen={expanded.videos}
        onToggle={() => toggle("videos")}
      >
        <TopVideosGrid videos={videos} userPlan={userPlan} hasShownVideos={hasShownVideos} channelId={channelId} />
      </CollapsibleSection>

      {/* Content Intelligence */}
      <CollapsibleSection
        title="Content Intelligence"
        isOpen={expanded.content}
        onToggle={() => toggle("content")}
      >
        <ContentIntelligenceBlock
          channelId={channelId}
          initialData={contentData}
          hasRequiredData={hasVideos}
        />
      </CollapsibleSection>

      {/* Momentum Insights */}
      <CollapsibleSection
        title="Momentum Insights"
        isOpen={expanded.momentum}
        onToggle={() => toggle("momentum")}
      >
        <MomentumInsights
          channelId={channelId}
          initialData={momentumData}
          hasRequiredData={hasVideos}
        />
      </CollapsibleSection>

      {/* Audience Insights */}
      <CollapsibleSection
        title="Audience & Engagement"
        isOpen={expanded.audience}
        onToggle={() => toggle("audience")}
      >
        <AudienceInsightsSection
          audienceData={audienceData}
          channelId={channelId}
          hasShownAudience={hasShownAudience}
          hasRequiredData={hasVideos}
        />
      </CollapsibleSection>

      {/* Comment Intelligence */}
      <CollapsibleSection
        title="Comment Intelligence"
        isOpen={expanded.comments}
        onToggle={() => toggle("comments")}
      >
        <CommentInsights
          channelId={channelId}
          initialData={commentsData}
          hasRequiredData={hasVideos && hasComments}
        />
      </CollapsibleSection>

      {/* Deep Comment Analysis */}
      <CollapsibleSection
        title="Deep Comment Analysis"
        isOpen={expanded.deepAnalysis}
        onToggle={() => toggle("deepAnalysis")}
      >
        <DeepCommentAnalysis
          channelId={channelId}
          initialData={deepAnalysisData}
          hasRequiredData={hasVideos && hasComments}
        />
      </CollapsibleSection>
    </div>
  )
}
