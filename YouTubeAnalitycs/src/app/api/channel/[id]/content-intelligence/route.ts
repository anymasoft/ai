import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, contentIntelligence } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

/**
 * POST /api/channel/[id]/content-intelligence
 * Генерирует AI-анализ контента канала на основе top videos
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

    console.log(`[ContentIntelligence] Запрос анализа для competitor ID: ${competitorId}`);

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

    console.log(`[ContentIntelligence] Канал найден: ${competitor.title}`);

    // Получаем top videos канала
    const videos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .orderBy(desc(channelVideos.viewCount))
      .limit(50) // Анализируем топ 50 видео
      .all();

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    console.log(`[ContentIntelligence] Найдено ${videos.length} видео для анализа`);

    // Проверяем, есть ли уже сохранённый анализ (не старше 7 дней)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const existingAnalysis = await db
      .select()
      .from(contentIntelligence)
      .where(
        and(
          eq(contentIntelligence.channelId, competitor.channelId),
        )
      )
      .orderBy(desc(contentIntelligence.generatedAt))
      .limit(1)
      .get();

    // Если анализ существует и свежий - возвращаем его
    if (existingAnalysis && existingAnalysis.generatedAt > sevenDaysAgo) {
      console.log(`[ContentIntelligence] Найден свежий анализ`);
      return NextResponse.json({
        ...JSON.parse(existingAnalysis.data),
        generatedAt: existingAnalysis.generatedAt,
      });
    }

    console.log(`[ContentIntelligence] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI
    const videosData = videos.map(v => ({
      title: v.title,
      viewCount: v.viewCount,
      publishedAt: v.publishedAt,
    }));

    // Инициализация OpenAI клиента
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Вызов OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты — эксперт по анализу YouTube контента. Твоя задача — выявить паттерны успешных видео."
        },
        {
          role: "user",
          content: `Проанализируй топ-видео YouTube канала "${competitor.title}" и выдели:

1) ключевые темы (themes) - о чем чаще всего снимают видео
2) форматы (formats) - какие типы контента используются (обзоры, туториалы, влоги, и т.д.)
3) повторяющиеся паттерны (patterns) - что общего у популярных видео (длина названий, ключевые слова, структура)
4) какие темы дают больше всего просмотров (opportunities)
5) конкретные рекомендации — что стоит снять автору канала (recommendations)

Видео для анализа:
${JSON.stringify(videosData, null, 2)}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "themes": ["тема 1", "тема 2", ...],
  "formats": ["формат 1", "формат 2", ...],
  "patterns": ["паттерн 1", "паттерн 2", ...],
  "opportunities": ["возможность 1", "возможность 2", ...],
  "recommendations": ["рекомендация 1", "рекомендация 2", ...]
}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log(`[ContentIntelligence] Получен ответ от OpenAI`);

    // Парсим JSON ответ
    const analysisData = JSON.parse(responseText);

    // Сохраняем результат в базу данных
    await db
      .insert(contentIntelligence)
      .values({
        channelId: competitor.channelId,
        data: JSON.stringify(analysisData),
        data_ru: null, // Сброс русского перевода при пересчёте
        generatedAt: Date.now(),
      })
      .run();

    console.log(`[ContentIntelligence] Анализ сохранён в БД`);

    // Возвращаем результат клиенту
    return NextResponse.json({
      ...analysisData,
      generatedAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    console.error("[ContentIntelligence] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate content intelligence" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/content-intelligence
 * Возвращает существующий AI-анализ контента (без генерации нового)
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
      .from(contentIntelligence)
      .where(eq(contentIntelligence.channelId, competitor.channelId))
      .orderBy(desc(contentIntelligence.generatedAt))
      .limit(1)
      .get();

    if (!analysis) {
      return NextResponse.json({ analysis: null });
    }

    return NextResponse.json({
      ...JSON.parse(analysis.data),
      generatedAt: analysis.generatedAt,
    });

  } catch (error) {
    console.error("[ContentIntelligence] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch content intelligence" },
      { status: 500 }
    );
  }
}
