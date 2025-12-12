import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { PDFBuilder } from "@/lib/pdf-generator"

/**
 * Безопасное преобразование даты (unix timestamp или ISO string)
 */
function safeDate(value: unknown): Date {
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (!isNaN(parsed)) return new Date(parsed)
  }
  return new Date() // fallback: now
}

/**
 * Безопасный парсинг outline
 */
function safeParseOutline(value: unknown): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value as string)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === "string") return parsed.split("\n").filter(Boolean)
    return []
  } catch {
    if (typeof value === "string") {
      return value.split("\n").filter(Boolean)
    }
    return []
  }
}

/**
 * GET /api/reports/script
 * Генерирует PDF-отчёт Full Script
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

    // Получаем скрипт
    const scriptResult = await db.execute({
      sql: `SELECT title, hook, outline, scriptText, whyItShouldWork, sourceVideos, createdAt
            FROM generated_scripts WHERE id = ? AND userId = ?`,
      args: [scriptId, userId],
    })

    if (scriptResult.rows.length === 0) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    const script = scriptResult.rows[0]
    const title = script.title as string
    const hook = script.hook as string
    const outline = safeParseOutline(script.outline)
    const scriptText = script.scriptText as string
    const whyItShouldWork = script.whyItShouldWork as string
    const sourceVideos = JSON.parse(script.sourceVideos as string || "[]") as string[]
    const createdAt = safeDate(script.createdAt)

    // Получаем информацию о source videos
    let sourceVideosTitles: string[] = []
    if (sourceVideos.length > 0) {
      const placeholders = sourceVideos.map(() => "?").join(",")
      const videosResult = await db.execute({
        sql: `SELECT title FROM channel_videos WHERE videoId IN (${placeholders})`,
        args: sourceVideos,
      })
      sourceVideosTitles = videosResult.rows.map((row) => row.title as string)
    }

    // Создаём PDF
    const pdf = await PDFBuilder.create({
      title: "Full Script Report",
      subtitle: title,
      generatedAt: createdAt,
    })

    // Hook
    pdf.addHighlightBox("Hook (First 3-5 Seconds)", hook)

    // Outline
    pdf.addSectionTitle("Script Outline")
    pdf.addList(outline, { numbered: true })

    // Full Script Text
    pdf.addSectionTitle("Full Script")

    // Разбиваем скрипт на параграфы
    const paragraphs = scriptText.split("\n\n").filter((p) => p.trim())
    paragraphs.forEach((paragraph) => {
      // Улучшенное определение заголовков
      const trimmed = paragraph.trim()
      const isProbablyHeading =
        trimmed.startsWith("##") ||
        trimmed.startsWith("**") ||
        (/^[A-ZА-ЯЁ].{0,60}$/.test(trimmed) && !trimmed.endsWith(".") && (trimmed.match(/\./g) || []).length < 2)

      if (isProbablyHeading) {
        const cleanTitle = trimmed.replace(/[#*]/g, "").trim()
        if (cleanTitle) {
          pdf.addSubtitle(cleanTitle)
        }
      } else {
        pdf.addParagraph(trimmed)
        pdf.addSpace(5)
      }
    })

    // Why It Should Work
    pdf.addDivider()
    pdf.addSectionTitle("Why This Script Should Perform Well")

    const whyParagraphs = whyItShouldWork.split("\n").filter((p) => p.trim())
    whyParagraphs.forEach((paragraph) => {
      if (paragraph.startsWith("-") || paragraph.startsWith("•")) {
        pdf.addList([paragraph.replace(/^[-•]\s*/, "")])
      } else {
        pdf.addParagraph(paragraph)
      }
    })

    // Source Videos
    if (sourceVideosTitles.length > 0) {
      pdf.addDivider()
      pdf.addSectionTitle("Source Videos (Inspiration)")
      pdf.addParagraph("This script was generated based on analysis of these competitor videos:")
      pdf.addList(sourceVideosTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t.slice(0, 60)}${t.length > 60 ? "..." : ""}`))

      // Показываем количество оставшихся видео
      if (sourceVideosTitles.length > 10) {
        pdf.addParagraph(`...and ${sourceVideosTitles.length - 10} more videos`)
      }
    }

    // Metadata
    pdf.addDivider()
    pdf.addSectionTitle("Script Metadata")
    pdf.addParagraph(`Script ID: ${scriptId}`)
    pdf.addParagraph(`Generated: ${createdAt.toLocaleString("en-US")}`)
    pdf.addParagraph(`Source Videos: ${sourceVideos.length}`)
    pdf.addParagraph(`Script Length: ${scriptText.length} characters`)
    pdf.addParagraph(`Estimated Read Time: ${Math.ceil(scriptText.split(" ").length / 150)} minutes`)

    const pdfBytes = await pdf.build()

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="script-report-${scriptId.slice(0, 8)}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Reports/Script] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 }
    )
  }
}
