import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { PDFBuilder } from "@/lib/pdf-generator"
import OpenAI from "openai"

/**
 * Семантическая карта - результат анализа видео
 */
interface SemanticMap {
  mergedTopics: string[]
  commonPatterns: string[]
  conflicts: string[]
  paradoxes: string[]
  emotionalSpikes: string[]
  visualMotifs: string[]
  audienceInterests: string[]
  rawSummary: string
}

/**
 * GET /api/reports/semantic
 * Генерирует PDF-отчёт Semantic Map
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const url = new URL(req.url)
    const scriptId = url.searchParams.get("scriptId")

    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    // Получаем скрипт и его sourceVideos
    const scriptResult = await db.execute({
      sql: `SELECT title, sourceVideos FROM generated_scripts WHERE id = ? AND userId = ?`,
      args: [scriptId, userId],
    })

    if (scriptResult.rows.length === 0) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    const scriptTitle = scriptResult.rows[0].title as string
    const sourceVideos = JSON.parse(scriptResult.rows[0].sourceVideos as string) as string[]

    // Получаем данные видео
    if (sourceVideos.length === 0) {
      return NextResponse.json({ error: "No source videos found" }, { status: 400 })
    }

    const placeholders = sourceVideos.map(() => "?").join(",")
    const videosResult = await db.execute({
      sql: `SELECT videoId, title, viewCount, likeCount, publishedAt FROM channel_videos WHERE videoId IN (${placeholders})`,
      args: sourceVideos,
    })

    // Генерируем SemanticMap через OpenAI
    const semanticMap = await generateSemanticMapForReport(
      videosResult.rows.map((row) => ({
        title: row.title as string,
        viewCount: Number(row.viewCount),
        likeCount: Number(row.likeCount),
      }))
    )

    // Создаём PDF
    const pdf = await PDFBuilder.create({
      title: "Semantic Map Report",
      subtitle: `Analysis for: ${scriptTitle}`,
      generatedAt: new Date(),
    })

    // Добавляем секции
    pdf.addSectionTitle("Executive Summary")
    pdf.addParagraph(semanticMap.rawSummary)
    pdf.addSpace(10)

    pdf.addSectionTitle("Merged Topics")
    pdf.addParagraph("Key themes identified across analyzed videos:")
    pdf.addList(semanticMap.mergedTopics)

    pdf.addSectionTitle("Common Patterns")
    pdf.addParagraph("Recurring patterns of success in the content:")
    pdf.addList(semanticMap.commonPatterns)

    pdf.addSectionTitle("Conflicts & Tensions")
    pdf.addParagraph("Conflicting ideas that create engagement:")
    pdf.addList(semanticMap.conflicts)

    pdf.addSectionTitle("Paradoxes")
    pdf.addParagraph("Counter-intuitive ideas that capture attention:")
    pdf.addList(semanticMap.paradoxes)

    pdf.addSectionTitle("Emotional Triggers")
    pdf.addParagraph("Emotional points that drive viewer reactions:")
    pdf.addList(semanticMap.emotionalSpikes, { bulletColor: { type: "RGB", red: 0.9, green: 0.3, blue: 0.3 } as any })

    pdf.addSectionTitle("Visual Motifs")
    pdf.addParagraph("Visual elements and scenes for video production:")
    pdf.addList(semanticMap.visualMotifs)

    pdf.addSectionTitle("Audience Interests")
    pdf.addParagraph("What the audience actively responds to:")
    pdf.addList(semanticMap.audienceInterests)

    // Добавляем данные исходных видео
    pdf.addDivider()
    pdf.addSectionTitle("Source Videos Analyzed")
    pdf.addTable(
      ["Title", "Views", "Likes"],
      videosResult.rows.slice(0, 10).map((row) => [
        (row.title as string).slice(0, 35) + "...",
        Number(row.viewCount).toLocaleString(),
        Number(row.likeCount).toLocaleString(),
      ]),
      { columnWidths: [280, 100, 100] }
    )

    const pdfBytes = await pdf.build()

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="semantic-map-report.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Reports/Semantic] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 }
    )
  }
}

async function generateSemanticMapForReport(
  videos: Array<{ title: string; viewCount: number; likeCount: number }>
): Promise<SemanticMap> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Analyze these video titles and metrics to create a Semantic Map.

VIDEOS:
${JSON.stringify(videos, null, 2)}

Create a semantic analysis with:
1. mergedTopics (5-8 items) - main themes across videos
2. commonPatterns (4-6 items) - success patterns
3. conflicts (3-4 items) - conflicting ideas
4. paradoxes (2-3 items) - counter-intuitive ideas
5. emotionalSpikes (4-5 items) - emotional triggers
6. visualMotifs (3-4 items) - visual elements
7. audienceInterests (4-5 items) - audience preferences
8. rawSummary (2-3 sentences) - overall analysis

Return ONLY valid JSON without markdown.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a content analyst. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    })

    const responseText = completion.choices[0]?.message?.content || ""
    const cleanJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    return JSON.parse(cleanJson)
  } catch {
    // Fallback
    return {
      mergedTopics: videos.slice(0, 5).map((v) => v.title.split(" ").slice(0, 3).join(" ")),
      commonPatterns: ["Engaging titles", "Clear value proposition", "Emotional hooks"],
      conflicts: ["Traditional vs Modern approaches"],
      paradoxes: ["Less is more in content strategy"],
      emotionalSpikes: ["Fear of missing out", "Desire for success"],
      visualMotifs: ["Before/After transformation"],
      audienceInterests: videos.slice(0, 4).map((v) => v.title.slice(0, 30)),
      rawSummary: `Analysis of ${videos.length} videos showing common themes and patterns.`,
    }
  }
}
