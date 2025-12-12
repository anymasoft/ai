import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { PDFBuilder } from "@/lib/pdf-generator"
import { containsCyrillic } from "@/lib/report-validators"

/**
 * GET /api/reports/insights
 * Генерирует PDF-отчёт Trending Insights
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const url = new URL(req.url)
    const period = parseInt(url.searchParams.get("period") || "30", 10)
    const validPeriod = [7, 30, 90].includes(period) ? period : 30

    // Получаем конкурентов пользователя
    const competitorsResult = await db.execute({
      sql: `SELECT channelId, title, subscriberCount, viewCount, videoCount
            FROM competitors WHERE userId = ? ORDER BY subscriberCount DESC`,
      args: [userId],
    })

    if (competitorsResult.rows.length === 0) {
      return NextResponse.json({ error: "No competitors found. Add competitors first." }, { status: 400 })
    }

    const channelIds = competitorsResult.rows.map((row) => row.channelId as string)
    const placeholders = channelIds.map(() => "?").join(",")

    // Получаем видео за период
    const periodStart = Date.now() - validPeriod * 24 * 60 * 60 * 1000
    const videosResult = await db.execute({
      sql: `SELECT v.videoId, v.channelId, v.title, v.viewCountInt, v.likeCountInt, v.publishDate, c.title as channelTitle
            FROM channel_videos v
            JOIN competitors c ON v.channelId = c.channelId
            WHERE v.channelId IN (${placeholders})
            ORDER BY v.viewCountInt DESC
            LIMIT 50`,
      args: channelIds,
    })

    // Фильтруем видео с валидной датой и рассчитываем momentum
    const videosWithMomentum = videosResult.rows
      .filter((row) => {
        const publishDate = row.publishDate as string;
        if (!publishDate || publishDate.startsWith("0000")) return false;
        try {
          const date = new Date(publishDate);
          return !isNaN(date.getTime());
        } catch {
          return false;
        }
      })
      .map((row) => {
        const viewCount = Number(row.viewCountInt)
        const publishDate = new Date(row.publishDate as string)
        const daysOld = Math.max(1, (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24))
        const viewsPerDay = viewCount / daysOld

        return {
          videoId: row.videoId as string,
          title: row.title as string,
          channelTitle: row.channelTitle as string,
          viewCount,
          likeCount: Number(row.likeCountInt),
          viewsPerDay: Math.round(viewsPerDay),
          publishDate: publishDate.toLocaleDateString("en-US"),
        }
      })

    // Сортируем по viewsPerDay (momentum)
    const topMomentum = [...videosWithMomentum].sort((a, b) => b.viewsPerDay - a.viewsPerDay).slice(0, 10)

    // Получаем последний trending_insights
    const insightsResult = await db.execute({
      sql: `SELECT summary, themes, formats, recommendations, generatedAt
            FROM trending_insights WHERE userId = ? ORDER BY generatedAt DESC LIMIT 1`,
      args: [userId],
    })

    let insightsSummary = "No AI insights generated yet. Go to Trending page to generate analysis."
    let themes: string[] = []
    let formats: string[] = []
    let recommendations: string[] = []

    if (insightsResult.rows.length > 0) {
      const insight = insightsResult.rows[0]
      insightsSummary = insight.summary as string
      themes = JSON.parse((insight.themes as string) || "[]")
      formats = JSON.parse((insight.formats as string) || "[]")
      recommendations = JSON.parse((insight.recommendations as string) || "[]")

      // Проверяем что insights на английском (PDF поддерживает только английский)
      if (
        containsCyrillic(insightsSummary) ||
        themes.some(t => containsCyrillic(t)) ||
        formats.some(f => containsCyrillic(f)) ||
        recommendations.some(r => containsCyrillic(r))
      ) {
        return NextResponse.json(
          { error: "Insights must be in English only" },
          { status: 400 }
        )
      }
    }

    // Создаём PDF
    const pdf = await PDFBuilder.create({
      title: "Trending Insights Report",
      subtitle: `Market Analysis - Last ${validPeriod} days`,
      generatedAt: new Date(),
    })

    // Summary
    pdf.addHighlightBox("Market Overview", insightsSummary)

    // Top Momentum Videos
    pdf.addSectionTitle("Top Momentum Videos")
    pdf.addParagraph("Videos with highest views per day (momentum score):")
    pdf.addTable(
      ["Title", "Channel", "Views/Day", "Total Views"],
      topMomentum.map((v) => [
        v.title.slice(0, 25) + "...",
        v.channelTitle.slice(0, 15),
        v.viewsPerDay.toLocaleString(),
        v.viewCount.toLocaleString(),
      ]),
      { columnWidths: [180, 100, 80, 80] }
    )

    // Competitors Overview
    pdf.addSectionTitle("Competitors Overview")
    pdf.addTable(
      ["Channel", "Subscribers", "Total Views", "Videos"],
      competitorsResult.rows.map((row) => [
        (row.title as string).slice(0, 25),
        Number(row.subscriberCount).toLocaleString(),
        Number(row.viewCount).toLocaleString(),
        String(row.videoCount),
      ]),
      { columnWidths: [180, 100, 120, 60] }
    )

    // Themes
    if (themes.length > 0) {
      pdf.addSectionTitle("Trending Themes")
      pdf.addList(themes)
    }

    // Formats
    if (formats.length > 0) {
      pdf.addSectionTitle("Popular Formats")
      pdf.addList(formats)
    }

    // Recommendations
    if (recommendations.length > 0) {
      pdf.addSectionTitle("Recommendations")
      pdf.addList(recommendations, { numbered: true })
    }

    // Statistics
    pdf.addDivider()
    pdf.addSectionTitle("Summary Statistics")

    const totalViews = competitorsResult.rows.reduce((sum, row) => sum + Number(row.viewCount), 0)
    const totalSubs = competitorsResult.rows.reduce((sum, row) => sum + Number(row.subscriberCount), 0)
    const avgViewsPerDay = topMomentum.length > 0
      ? Math.round(topMomentum.reduce((sum, v) => sum + v.viewsPerDay, 0) / topMomentum.length)
      : 0

    pdf.addParagraph(`Total Competitors: ${competitorsResult.rows.length}`)
    pdf.addParagraph(`Combined Subscribers: ${totalSubs.toLocaleString()}`)
    pdf.addParagraph(`Combined Views: ${totalViews.toLocaleString()}`)
    pdf.addParagraph(`Videos Analyzed: ${videosResult.rows.length}`)
    pdf.addParagraph(`Average Momentum (views/day): ${avgViewsPerDay.toLocaleString()}`)

    const pdfBytes = await pdf.build()

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="trending-insights-report.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Reports/Insights] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 }
    )
  }
}
