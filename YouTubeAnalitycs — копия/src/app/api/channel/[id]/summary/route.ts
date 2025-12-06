import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
// import { analyzeChannel } from "@/lib/ai/analyzeChannel"; // Временно отключено - генерация будет позже

/**
 * GET /api/channel/[id]/summary
 * Возвращает существующий AI-анализ канала (без генерации новых)
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

    // Проверка аутентификации
    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Получаем ID канала из параметров URL
    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[API] Запрос AI-анализа для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    // Проверяем что канал существует и принадлежит пользователю
    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    const competitor = competitorResult.rows[0];

    console.log(`[API] Канал найден: ${competitor.title} (@${competitor.handle})`);

    // Проверяем, есть ли уже сохранённый AI-анализ
    const existingInsightResult = await client.execute({
      sql: "SELECT * FROM ai_insights WHERE competitorId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [competitorId],
    });

    // Если анализ существует - возвращаем его
    if (existingInsightResult.rows.length > 0) {
      const existingInsight = existingInsightResult.rows[0];
      console.log(`[API] Найден существующий AI-анализ (ID: ${existingInsight.id})`);

      client.close();

      return NextResponse.json({
        id: existingInsight.id,
        competitorId: existingInsight.competitorId,
        summary: existingInsight.summary,
        strengths: JSON.parse(existingInsight.strengths as string),
        weaknesses: JSON.parse(existingInsight.weaknesses as string),
        opportunities: JSON.parse(existingInsight.opportunities as string),
        threats: JSON.parse(existingInsight.threats as string),
        recommendations: JSON.parse(existingInsight.recommendations as string),
        createdAt: existingInsight.createdAt,
      });
    }

    // Если анализа нет - возвращаем null (генерация отключена на этом этапе)
    console.log("[API] AI-анализ не найден, возвращаем null");
    client.close();
    return NextResponse.json({ insight: null });

    /*
    // ========== КОД ГЕНЕРАЦИИ AI-АНАЛИЗА (ОТКЛЮЧЁН) ==========
    // Будет активирован позже, когда появится полноценная аналитика

    console.log("[API] AI-анализ не найден, генерируем новый...");

    // Генерируем новый AI-анализ
    const analysis = await analyzeChannel({
      title: competitor.title,
      handle: competitor.handle,
      subscriberCount: competitor.subscriberCount,
      videoCount: competitor.videoCount,
      viewCount: competitor.viewCount,
    });

    console.log("[API] AI-анализ получен, сохраняем в БД...");

    // Сохраняем результат в базу данных
    const savedInsightResult = await client.execute({
      sql: `INSERT INTO ai_insights (
        competitorId, summary, strengths, weaknesses, opportunities, threats, recommendations, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        competitorId,
        String(analysis.summary),
        JSON.stringify(analysis.strengths),
        JSON.stringify(analysis.weaknesses),
        JSON.stringify(analysis.opportunities),
        JSON.stringify(analysis.threats),
        JSON.stringify(analysis.recommendations),
        Date.now(),
      ],
    });

    console.log(`[API] AI-анализ сохранён (ID: ${savedInsightResult.lastInsertRowid})`);

    client.close();

    // Возвращаем результат клиенту
    return NextResponse.json(
      {
        id: Number(savedInsightResult.lastInsertRowid),
        competitorId: competitorId,
        summary: String(analysis.summary),
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
        threats: analysis.threats,
        recommendations: analysis.recommendations,
        createdAt: Date.now(),
      },
      { status: 201 }
    );
    */
  } catch (error) {
    client.close();
    console.error("[API] Ошибка при получении AI-анализа:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to fetch channel summary" },
      { status: 500 }
    );
  }
}
