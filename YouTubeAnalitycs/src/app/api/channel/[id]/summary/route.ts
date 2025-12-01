import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, aiInsights } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { analyzeChannel } from "@/lib/ai/analyzeChannel";

/**
 * POST /api/channel/[id]/summary
 * Генерирует или возвращает AI-анализ канала
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    // Проверка аутентификации
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Получаем ID канала из параметров URL
    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[API] Запрос AI-анализа для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitor = await db
      .select()
      .from(competitors)
      .where(
        and(
          eq(competitors.id, competitorId),
          eq(competitors.userId, session.user.id)
        )
      )
      .get();

    // Проверяем что канал существует и принадлежит пользователю
    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    console.log(`[API] Канал найден: ${competitor.title} (@${competitor.handle})`);

    // Проверяем, есть ли уже сохранённый AI-анализ
    const existingInsight = await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.competitorId, competitorId))
      .orderBy(desc(aiInsights.createdAt))
      .limit(1)
      .get();

    // Если анализ уже существует, возвращаем его
    if (existingInsight) {
      console.log(`[API] Найден существующий AI-анализ (ID: ${existingInsight.id})`);

      return NextResponse.json({
        id: existingInsight.id,
        competitorId: existingInsight.competitorId,
        summary: existingInsight.summary,
        strengths: JSON.parse(existingInsight.strengths),
        weaknesses: JSON.parse(existingInsight.weaknesses),
        opportunities: JSON.parse(existingInsight.opportunities),
        threats: JSON.parse(existingInsight.threats),
        recommendations: JSON.parse(existingInsight.recommendations),
        createdAt: existingInsight.createdAt,
      });
    }

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
    const savedInsight = await db
      .insert(aiInsights)
      .values({
        competitorId: competitorId,
        summary: String(analysis.summary),
        strengths: JSON.stringify(analysis.strengths),
        weaknesses: JSON.stringify(analysis.weaknesses),
        opportunities: JSON.stringify(analysis.opportunities),
        threats: JSON.stringify(analysis.threats),
        recommendations: JSON.stringify(analysis.recommendations),
        createdAt: Date.now(),
      })
      .returning()
      .get();

    console.log(`[API] AI-анализ сохранён (ID: ${savedInsight.id})`);

    // Возвращаем результат клиенту
    return NextResponse.json(
      {
        id: savedInsight.id,
        competitorId: savedInsight.competitorId,
        summary: savedInsight.summary,
        strengths: JSON.parse(savedInsight.strengths),
        weaknesses: JSON.parse(savedInsight.weaknesses),
        opportunities: JSON.parse(savedInsight.opportunities),
        threats: JSON.parse(savedInsight.threats),
        recommendations: JSON.parse(savedInsight.recommendations),
        createdAt: savedInsight.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Ошибка при генерации AI-анализа:", error);

    if (error instanceof Error) {
      // Специфичные ошибки от OpenAI
      if (error.message.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured" },
          { status: 500 }
        );
      }

      if (error.message.includes("AI analysis failed")) {
        return NextResponse.json(
          { error: "Failed to generate AI analysis. Please try again later." },
          { status: 500 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate channel summary" },
      { status: 500 }
    );
  }
}
