"use client"

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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">AI Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Deep insights powered by artificial intelligence
        </p>
      </div>

      {/* Charts */}
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
      />

      {/* Momentum Insights */}
      <MomentumInsights
        channelId={channelId}
        initialData={momentumData}
        hasRequiredData={hasVideos}
      />

      {/* Audience & Engagement */}
      <AudienceInsights
        channelId={channelId}
        initialData={audienceData}
        hasRequiredData={hasVideos}
      />

      {/* Comment Intelligence */}
      <CommentInsights
        channelId={channelId}
        initialData={commentsData}
        hasRequiredData={hasVideos && hasComments}
      />

      {/* Deep Comment Analysis (AI v2.0) */}
      <DeepCommentAnalysis
        channelId={channelId}
        initialData={deepAnalysisData}
        hasRequiredData={hasVideos && hasComments}
      />
    </div>
  )
}
