"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChannelGrowthChart } from "@/components/charts/ChannelGrowthChart"
import { TopVideosGrid } from "@/components/channel/TopVideosGrid"
import { ContentIntelligenceBlock } from "@/components/channel/ContentIntelligenceBlock"
import { MomentumInsights } from "@/components/channel/MomentumInsights"
import { AudienceInsights } from "@/components/channel/AudienceInsights"
import { CommentInsights } from "@/components/channel/CommentInsights"
import { DeepCommentAnalysis } from "@/components/channel/DeepCommentAnalysis"

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
}: ChannelAnalyticsProps) {
  const [analysisLanguage, setAnalysisLanguage] = useState<"en" | "ru">("en")

  return (
    <div className="space-y-6">
      {/* Analysis Language Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">AI Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Deep insights powered by artificial intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Analysis Language:</span>
          <div className="inline-flex rounded-lg border border-border p-1">
            <Button
              variant={analysisLanguage === "en" ? "default" : "ghost"}
              size="sm"
              onClick={() => setAnalysisLanguage("en")}
              className="cursor-pointer"
            >
              English
            </Button>
            <Button
              variant={analysisLanguage === "ru" ? "default" : "ghost"}
              size="sm"
              onClick={() => setAnalysisLanguage("ru")}
              className="cursor-pointer"
            >
              Русский
            </Button>
          </div>
        </div>
      </div>

      {/* Charts - no translation needed */}
      <ChannelGrowthChart
        metrics={metrics}
        title="Growth Over Time"
        description="Historical metrics"
      />

      <TopVideosGrid videos={videos} />

      {/* AI Content Intelligence */}
      <ContentIntelligenceBlock
        channelId={channelId}
        initialData={contentData}
        hasRequiredData={hasVideos}
        analysisLanguage={analysisLanguage}
      />

      {/* Momentum Insights */}
      <MomentumInsights
        channelId={channelId}
        initialData={momentumData}
        hasRequiredData={hasVideos}
        analysisLanguage={analysisLanguage}
      />

      {/* Audience & Engagement */}
      <AudienceInsights
        channelId={channelId}
        initialData={audienceData}
        hasRequiredData={hasVideos}
        analysisLanguage={analysisLanguage}
      />

      {/* Comment Intelligence */}
      <CommentInsights
        channelId={channelId}
        initialData={commentsData}
        hasRequiredData={hasVideos && hasComments}
        analysisLanguage={analysisLanguage}
      />

      {/* Deep Comment Analysis (AI v2.0) */}
      <DeepCommentAnalysis
        channelId={channelId}
        initialData={deepAnalysisData}
        hasRequiredData={hasVideos && hasComments}
        analysisLanguage={analysisLanguage}
      />
    </div>
  )
}
