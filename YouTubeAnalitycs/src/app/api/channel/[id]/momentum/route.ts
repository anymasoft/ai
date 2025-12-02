import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, momentumInsights } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

interface VideoWithMomentum {
  id: number;
  videoId: string;
  title: string;
  viewCount: number;
  publishedAt: string;
  viewsPerDay: number;
  momentumScore: number;
  category: "High Momentum" | "Rising" | "Normal" | "Underperforming";
}

/**
 * Вычисляет медиану массива чисел
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

/**
 * Вычисляет количество дней с момента публикации
 */
function daysSincePublish(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - publishDate.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(days, 1); // Минимум 1 день
}

/**
 * POST /api/channel/[id]/momentum
 * Генерирует momentum анализ для видео канала
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

    console.log(`[Momentum] Запрос анализа для competitor ID: ${competitorId}`);

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

    console.log(`[Momentum] Канал найден: ${competitor.title}`);

    // Получаем последние 150 видео канала
    const videos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .orderBy(desc(channelVideos.publishedAt))
      .limit(150)
      .all();

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    console.log(`[Momentum] Найдено ${videos.length} видео для анализа`);

    // Вычисляем views_per_day для каждого видео
    const videosWithMetrics: VideoWithMomentum[] = videos.map(v => {
      const days = daysSincePublish(v.publishedAt);
      const viewsPerDay = v.viewCount / days;

      return {
        id: v.id,
        videoId: v.videoId,
        title: v.title,
        viewCount: v.viewCount,
        publishedAt: v.publishedAt,
        viewsPerDay,
        momentumScore: 0, // Будет вычислен позже
        category: "Normal" as const,
      };
    });

    // Вычисляем медиану views_per_day
    const viewsPerDayValues = videosWithMetrics.map(v => v.viewsPerDay);
    const medianViewsPerDay = calculateMedian(viewsPerDayValues);

    console.log(`[Momentum] Медиана views_per_day: ${medianViewsPerDay.toFixed(2)}`);

    // Вычисляем momentum_score и категоризируем видео
    videosWithMetrics.forEach(v => {
      v.momentumScore = (v.viewsPerDay / medianViewsPerDay) - 1;

      if (v.momentumScore > 0.5) {
        v.category = "High Momentum";
      } else if (v.momentumScore > 0.1) {
        v.category = "Rising";
      } else if (v.momentumScore < -0.3) {
        v.category = "Underperforming";
      } else {
        v.category = "Normal";
      }
    });

    // Фильтруем High Momentum видео
    const highMomentumVideos = videosWithMetrics
      .filter(v => v.category === "High Momentum")
      .sort((a, b) => b.momentumScore - a.momentumScore)
      .slice(0, 20); // Топ 20

    console.log(`[Momentum] High Momentum видео: ${highMomentumVideos.length}`);

    if (highMomentumVideos.length === 0) {
      return NextResponse.json(
        { error: "No high momentum videos found" },
        { status: 400 }
      );
    }

    // Проверяем, есть ли уже свежий анализ (не старше 3 дней)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const existingAnalysis = await db
      .select()
      .from(momentumInsights)
      .where(eq(momentumInsights.channelId, competitor.channelId))
      .orderBy(desc(momentumInsights.generatedAt))
      .limit(1)
      .get();

    // Если анализ существует и свежий - возвращаем его
    if (existingAnalysis && existingAnalysis.generatedAt > threeDaysAgo) {
      console.log(`[Momentum] Найден свежий анализ`);
      return NextResponse.json({
        ...JSON.parse(existingAnalysis.data),
        generatedAt: existingAnalysis.generatedAt,
      });
    }

    console.log(`[Momentum] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI
    const videosForAnalysis = highMomentumVideos.map(v => ({
      title: v.title,
      viewCount: v.viewCount,
      viewsPerDay: Math.round(v.viewsPerDay),
      momentumScore: `+${(v.momentumScore * 100).toFixed(0)}%`,
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
          content: "Ты — эксперт по анализу трендов YouTube. Твоя задача — выявить темы и форматы, которые растут прямо сейчас."
        },
        {
          role: "user",
          content: `Проанализируй список видео с высоким momentum (показы выше медианы на 50%+) канала "${competitor.title}".

Выяви:
1) hotThemes - основные темы, которые дают высокие показы сейчас
2) hotFormats - форматы видео, которые работают лучше всего
3) hotIdeas - конкретные идеи для создания контента
4) explanation - краткое объяснение почему эти темы растут

Видео с High Momentum:
${JSON.stringify(videosForAnalysis, null, 2)}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "hotThemes": ["тема 1", "тема 2", ...],
  "hotFormats": ["формат 1", "формат 2", ...],
  "hotIdeas": ["идея 1", "идея 2", ...],
  "explanation": "краткое объяснение..."
}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log(`[Momentum] Получен ответ от OpenAI`);

    // Парсим JSON ответ
    const aiAnalysis = JSON.parse(responseText);

    // Формируем итоговые данные
    const momentumData = {
      highMomentumVideos: highMomentumVideos.slice(0, 10).map(v => ({
        videoId: v.videoId,
        title: v.title,
        viewCount: v.viewCount,
        viewsPerDay: Math.round(v.viewsPerDay),
        momentumScore: v.momentumScore,
        publishedAt: v.publishedAt,
      })),
      stats: {
        totalAnalyzed: videos.length,
        highMomentum: highMomentumVideos.length,
        rising: videosWithMetrics.filter(v => v.category === "Rising").length,
        medianViewsPerDay: Math.round(medianViewsPerDay),
      },
      ...aiAnalysis,
    };

    // Сохраняем результат в базу данных
    await db
      .insert(momentumInsights)
      .values({
        channelId: competitor.channelId,
        data: JSON.stringify(momentumData),
        generatedAt: Date.now(),
      })
      .run();

    console.log(`[Momentum] Анализ сохранён в БД`);

    // Возвращаем результат клиенту
    return NextResponse.json({
      ...momentumData,
      generatedAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    console.error("[Momentum] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate momentum analysis" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/momentum
 * Возвращает существующий momentum анализ
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
      .from(momentumInsights)
      .where(eq(momentumInsights.channelId, competitor.channelId))
      .orderBy(desc(momentumInsights.generatedAt))
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
    console.error("[Momentum] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch momentum analysis" },
      { status: 500 }
    );
  }
}
