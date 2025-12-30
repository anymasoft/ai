import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { PDFBuilder } from "@/lib/pdf-generator"
import OpenAI from "openai"

/**
 * Нарративный скелет - каркас будущего сценария
 */
interface NarrativeSkeleton {
  coreIdea: string
  centralParadox: string
  mainConflict: string
  mainQuestion: string
  emotionalBeats: string[]
  storyBeats: string[]
  visualMotifs: string[]
  hookCandidates: string[]
  endingIdeas: string[]
}

/**
 * GET /api/reports/skeleton
 * Генерирует PDF-отчёт Narrative Skeleton
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
      sql: `SELECT title, hook, outline, scriptText, whyItShouldWork, sourceVideos
            FROM generated_scripts WHERE id = ? AND userId = ?`,
      args: [scriptId, userId],
    })

    if (scriptResult.rows.length === 0) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    const script = scriptResult.rows[0]
    const scriptTitle = script.title as string
    const scriptHook = script.hook as string
    const outline = JSON.parse(script.outline as string) as string[]

    // Генерируем NarrativeSkeleton через OpenAI
    const skeleton = await generateNarrativeSkeletonForReport(
      scriptTitle,
      scriptHook,
      outline,
      script.scriptText as string
    )

    // Создаём PDF
    const pdf = await PDFBuilder.create({
      title: "Narrative Skeleton Report",
      subtitle: `Story Framework for: ${scriptTitle}`,
      generatedAt: new Date(),
    })

    // Core Idea
    pdf.addHighlightBox("Core Idea", skeleton.coreIdea)

    // Central Paradox
    pdf.addSectionTitle("Central Paradox")
    pdf.addParagraph(skeleton.centralParadox)
    pdf.addSpace(10)

    // Main Conflict
    pdf.addSectionTitle("Main Conflict")
    pdf.addParagraph(skeleton.mainConflict)
    pdf.addSpace(10)

    // Main Question
    pdf.addHighlightBox("Main Question", skeleton.mainQuestion)

    // Emotional Beats
    pdf.addSectionTitle("Emotional Beats")
    pdf.addParagraph("Key emotional moments throughout the narrative:")
    pdf.addList(skeleton.emotionalBeats, { numbered: true })

    // Story Beats
    pdf.addSectionTitle("Story Structure")
    pdf.addParagraph("Sequence of narrative blocks from hook to ending:")
    pdf.addList(skeleton.storyBeats, { numbered: true })

    // Visual Motifs
    pdf.addSectionTitle("Visual Motifs")
    pdf.addParagraph("Visual elements and metaphors for production:")
    pdf.addList(skeleton.visualMotifs)

    // Hook Candidates
    pdf.addSectionTitle("Hook Candidates")
    pdf.addParagraph("Powerful opening options for the first 3-5 seconds:")
    pdf.addList(skeleton.hookCandidates)

    // Ending Ideas
    pdf.addSectionTitle("Ending Ideas")
    pdf.addParagraph("Options for memorable conclusions:")
    pdf.addList(skeleton.endingIdeas)

    // Original Outline
    pdf.addDivider()
    pdf.addSectionTitle("Original Script Outline")
    pdf.addList(outline, { numbered: true })

    const pdfBytes = await pdf.build()

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="narrative-skeleton-report.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Reports/Skeleton] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 }
    )
  }
}

async function generateNarrativeSkeletonForReport(
  title: string,
  hook: string,
  outline: string[],
  scriptText: string
): Promise<NarrativeSkeleton> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Based on this script, create a Narrative Skeleton (story framework).

TITLE: ${title}
HOOK: ${hook}
OUTLINE: ${outline.join(", ")}
SCRIPT EXCERPT: ${scriptText.slice(0, 1500)}...

Create:
1. coreIdea - main idea (1 sentence)
2. centralParadox - central paradox (1-2 sentences)
3. mainConflict - main conflict (1-2 sentences)
4. mainQuestion - question that keeps viewer engaged
5. emotionalBeats (4-6 items) - emotional moments
6. storyBeats (5-8 items) - narrative structure blocks
7. visualMotifs (3-5 items) - visual elements
8. hookCandidates (3-5 items) - opening variations
9. endingIdeas (2-4 items) - conclusion options

Return ONLY valid JSON without markdown.
ALL TEXT MUST BE IN ENGLISH.
Use ASCII characters only.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a storytelling expert. Return only valid JSON. ALL OUTPUT MUST BE IN ENGLISH ONLY." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    })

    const responseText = completion.choices[0]?.message?.content || ""
    const cleanJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    return JSON.parse(cleanJson)
  } catch {
    // Fallback на английском если генерация не сработала
    return {
      coreIdea: `Video about ${title}`,
      centralParadox: "What seems complex is actually simple when you understand the core principle.",
      mainConflict: "Traditional approach vs innovative methods",
      mainQuestion: "How can you achieve better results with less effort?",
      emotionalBeats: ["Intrigue at the start", "Building tension", "Climax", "Resolution"],
      storyBeats: outline.length > 0 ? outline : ["Hook", "Problem", "Solution", "Call to action"],
      visualMotifs: ["Transformation", "Before/After", "Success moment"],
      hookCandidates: [hook, `Did you know that ${title.toLowerCase()}?`],
      endingIdeas: ["Summary with CTA", "Open question for comments", "Teaser for next video"],
    }
  }
}
