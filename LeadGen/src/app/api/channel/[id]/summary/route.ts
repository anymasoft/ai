import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { analyzeChannel, type ChannelSwotAnalysis, type SwotPoint, type VideoIdea } from "@/lib/ai/analyzeChannel";

/**
 * GET /api/channel/[id]/summary
 * Возвращает существующий AI-анализ канала (если есть)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    // Проверяем что канал принадлежит пользователю
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    // Получаем существующий AI-анализ
    const insightResult = await client.execute({
      sql: "SELECT * FROM ai_insights WHERE competitorId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [competitorId],
    });

    client.close();

    if (insightResult.rows.length === 0) {
      return NextResponse.json({ insight: null });
    }

    const row = insightResult.rows[0];

    // Парсим данные из БД
    const insight: ChannelSwotAnalysis = {
      strengths: JSON.parse(row.strengths as string) as SwotPoint[],
      weaknesses: JSON.parse(row.weaknesses as string) as SwotPoint[],
      opportunities: JSON.parse(row.opportunities as string) as SwotPoint[],
      threats: JSON.parse(row.threats as string) as SwotPoint[],
      strategicSummary: row.strategicSummary ? JSON.parse(row.strategicSummary as string) as string[] : [],
      contentPatterns: row.contentPatterns ? JSON.parse(row.contentPatterns as string) as string[] : [],
      videoIdeas: row.videoIdeas ? JSON.parse(row.videoIdeas as string) as VideoIdea[] : [],
      generatedAt: row.generatedAt as string || new Date(row.createdAt as number).toISOString(),
    };

    return NextResponse.json({ insight });
  } catch (error) {
    client.close();
    console.error("[API] Ошибка при получении AI-анализа:", error);

    const errorMessage = error instanceof Error
      ? (error.message || "Failed to fetch AI insights")
      : String(error) || "Failed to fetch AI insights";

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/channel/[id]/summary
 * Генерирует новый AI-анализ канала и сохраняет в БД
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[API] Запрос генерации AI-анализа для competitor ID: ${competitorId}`);

    // Проверяем что канал принадлежит пользователю
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    const competitor = competitorResult.rows[0];

    console.log(`[API] Канал найден: ${competitor.title} (@${competitor.handle})`);
    console.log(`[API] Запуск генерации детального SWOT-анализа...`);

    // Генерируем AI-анализ
    const analysis = await analyzeChannel(competitorId.toString());

    console.log("[API] AI-анализ получен, сохраняем в БД...");

    // Сохраняем в базу данных
    const savedInsightResult = await client.execute({
      sql: `INSERT INTO ai_insights (
        competitorId,
        summary,
        strengths,
        weaknesses,
        opportunities,
        threats,
        recommendations,
        strategicSummary,
        contentPatterns,
        videoIdeas,
        generatedAt,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        competitorId,
        analysis.strategicSummary.join('\n\n'), // summary = первые абзацы стратегического резюме
        JSON.stringify(analysis.strengths),
        JSON.stringify(analysis.weaknesses),
        JSON.stringify(analysis.opportunities),
        JSON.stringify(analysis.threats),
        JSON.stringify(analysis.videoIdeas.map(v => v.title)), // recommendations = названия идей видео
        JSON.stringify(analysis.strategicSummary),
        JSON.stringify(analysis.contentPatterns),
        JSON.stringify(analysis.videoIdeas),
        analysis.generatedAt,
        Date.now(),
      ],
    });

    console.log(`[API] AI-анализ сохранён (ID: ${savedInsightResult.lastInsertRowid})`);

    client.close();

    // Возвращаем результат
    return NextResponse.json(
      {
        insight: analysis,
        id: Number(savedInsightResult.lastInsertRowid)
      },
      { status: 201 }
    );
  } catch (error) {
    client.close();
    console.error("[API] Ошибка при генерации AI-анализа:", error);

    const errorMessage = error instanceof Error
      ? (error.message || "Failed to generate AI insights")
      : String(error) || "Failed to generate AI insights";

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
