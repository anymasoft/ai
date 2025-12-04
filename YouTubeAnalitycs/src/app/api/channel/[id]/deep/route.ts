import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, deepAudience } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

/**
 * POST /api/channel/[id]/deep
 * Генерирует Deep Audience Intelligence анализ
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[DeepAudience] Запрос анализа для competitor ID: ${competitorId}`);

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

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    console.log(`[DeepAudience] Канал найден: ${competitor.title}`);

    // Проверяем, есть ли уже свежий анализ (не старше 7 дней)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const existingAnalysis = await db
      .select()
      .from(deepAudience)
      .where(eq(deepAudience.channelId, competitor.channelId))
      .orderBy(desc(deepAudience.createdAt))
      .limit(1)
      .get();

    if (existingAnalysis && existingAnalysis.createdAt > sevenDaysAgo) {
      console.log(`[DeepAudience] Найден свежий анализ`);
      return NextResponse.json({
        ...JSON.parse(existingAnalysis.data),
        createdAt: existingAnalysis.createdAt,
      });
    }

    console.log(`[DeepAudience] Генерируем новый анализ через OpenAI...`);

    // Инициализация OpenAI клиента
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Простой промпт для демонстрации
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert in YouTube audience analysis. Provide deep insights about audience behavior, preferences, and patterns."
        },
        {
          role: "user",
          content: `Analyze the audience of YouTube channel "${competitor.title}". Provide insights in JSON format with these fields:
- audienceProfile: array of audience characteristics
- contentPreferences: array of what audience likes
- engagementPatterns: array of how audience interacts
- recommendations: array of actionable recommendations

Return ONLY JSON without any additional text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log(`[DeepAudience] Получен ответ от OpenAI`);

    // Парсим JSON ответ
    const aiAnalysis = JSON.parse(responseText);

    // Формируем итоговые данные
    const deepAudienceData = {
      ...aiAnalysis,
      totalAnalyzed: 1,
      channelTitle: competitor.title,
    };

    // Сохраняем результат в базу данных
    await db
      .insert(deepAudience)
      .values({
        channelId: competitor.channelId,
        data: JSON.stringify(deepAudienceData),
        data_ru: null, // Сброс русского перевода при пересчёте
        createdAt: Date.now(),
      })
      .run();

    console.log(`[DeepAudience] Анализ сохранён в БД`);

    // Возвращаем результат клиенту
    return NextResponse.json({
      ...deepAudienceData,
      createdAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    console.error("[DeepAudience] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate deep audience analysis" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/deep
 * Возвращает существующий Deep Audience Intelligence анализ
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    // Получаем данные канала
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

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    // Получаем последний анализ
    const analysis = await db
      .select()
      .from(deepAudience)
      .where(eq(deepAudience.channelId, competitor.channelId))
      .orderBy(desc(deepAudience.createdAt))
      .limit(1)
      .get();

    if (!analysis) {
      return NextResponse.json({ analysis: null });
    }

    console.log(`[DeepAudience GET] Найден анализ для channelId: ${competitor.channelId}, hasDataRu: ${!!analysis.data_ru}`);

    // Возвращаем обе версии (EN и RU) в сыром виде, UI сам выберет нужную
    const response: any = {
      createdAt: analysis.createdAt,
      hasRussianVersion: !!analysis.data_ru,
      data: analysis.data, // Английский JSON как строка
    };

    // Возвращаем data_ru если есть
    if (analysis.data_ru) {
      response.data_ru = analysis.data_ru; // Русский JSON как строка
      console.log(`[DeepAudience GET] data_ru найден, длина: ${analysis.data_ru.length} символов`);
    }

    // Для обратной совместимости добавляем распарсенные поля основного анализа
    const parsed = JSON.parse(analysis.data);
    Object.assign(response, parsed);

    return NextResponse.json(response);

  } catch (error) {
    console.error("[DeepAudience] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch deep audience analysis" },
      { status: 500 }
    );
  }
}
