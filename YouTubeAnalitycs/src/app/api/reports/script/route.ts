import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { PDFBuilder } from "@/lib/pdf-generator"

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
    const outline = JSON.parse(script.outline as string) as string[]
    const scriptText = script.scriptText as string
    const whyItShouldWork = script.whyItShouldWork as string
    const sourceVideos = JSON.parse(script.sourceVideos as string) as string[]
    const createdAt = new Date(Number(script.createdAt))

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
      // Проверяем, является ли это заголовком секции
      if (paragraph.startsWith("##") || paragraph.startsWith("**") || paragraph.length < 50) {
        const cleanTitle = paragraph.replace(/[#*]/g, "").trim()
        if (cleanTitle) {
          pdf.addSubtitle(cleanTitle)
        }
      } else {
        pdf.addParagraph(paragraph.trim())
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
