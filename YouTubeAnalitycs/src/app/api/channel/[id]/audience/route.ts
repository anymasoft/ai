import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, audienceInsights } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

interface VideoWithEngagement {
  id: number;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  engagementScore: number;
  likeRate: number;
  commentRate: number;
  category: "High Engagement" | "Rising" | "Normal" | "Weak";
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
 * POST /api/channel/[id]/audience
 * Генерирует audience engagement анализ для видео канала
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

    console.log(`[Audience] Запрос анализа для competitor ID: ${competitorId}`);

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

    console.log(`[Audience] Канал найден: ${competitor.title}`);

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

    console.log(`[Audience] Найдено ${videos.length} видео для анализа`);

    // Вычисляем engagement метрики для каждого видео
    const videosWithMetrics: VideoWithEngagement[] = videos.map(v => {
      const engagementScore = v.viewCount > 0
        ? (v.likeCount + v.commentCount) / v.viewCount
        : 0;
      const likeRate = v.viewCount > 0 ? v.likeCount / v.viewCount : 0;
      const commentRate = v.viewCount > 0 ? v.commentCount / v.viewCount : 0;

      return {
        id: v.id,
        title: v.title,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
        publishedAt: v.publishedAt,
        engagementScore,
        likeRate,
        commentRate,
        category: "Normal" as const,
      };
    });

    // Вычисляем медиану engagement_score
    const engagementScores = videosWithMetrics.map(v => v.engagementScore);
    const medianEngagement = calculateMedian(engagementScores);

    console.log(`[Audience] Медиана engagement_score: ${medianEngagement.toFixed(6)}`);

    // Категоризируем видео по engagement
    videosWithMetrics.forEach(v => {
      const engagementDiff = medianEngagement > 0
        ? (v.engagementScore / medianEngagement) - 1
        : 0;

      if (engagementDiff > 0.5) {
        v.category = "High Engagement";
      } else if (engagementDiff > 0.1) {
        v.category = "Rising";
      } else if (engagementDiff < -0.3) {
        v.category = "Weak";
      } else {
        v.category = "Normal";
      }
    });

    // Фильтруем High Engagement видео
    const highEngagementVideos = videosWithMetrics
      .filter(v => v.category === "High Engagement")
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 30); // Топ 30

    console.log(`[Audience] High Engagement видео: ${highEngagementVideos.length}`);

    if (highEngagementVideos.length === 0) {
      return NextResponse.json(
        { error: "No high engagement videos found" },
        { status: 400 }
      );
    }

    // Проверяем, есть ли уже свежий анализ (не старше 3 дней)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const existingAnalysis = await db
      .select()
      .from(audienceInsights)
      .where(eq(audienceInsights.channelId, competitor.channelId))
      .orderBy(desc(audienceInsights.generatedAt))
      .limit(1)
      .get();

    // Если анализ существует и свежий - возвращаем его
    if (existingAnalysis && existingAnalysis.generatedAt > threeDaysAgo) {
      console.log(`[Audience] Найден свежий анализ`);
      return NextResponse.json({
        ...JSON.parse(existingAnalysis.data),
        generatedAt: existingAnalysis.generatedAt,
      });
    }

    console.log(`[Audience] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI
    const videosForAnalysis = highEngagementVideos.map(v => ({
      title: v.title,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      engagementScore: v.engagementScore.toFixed(6),
      likeRate: `${(v.likeRate * 100).toFixed(2)}%`,
      commentRate: `${(v.commentRate * 100).toFixed(2)}%`,
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
          content: "Ты — эксперт по анализу вовлеченности аудитории YouTube. Твоя задача — выявить паттерны высокого engagement."
        },
        {
          role: "user",
          content: `Проанализируй список видео с высоким engagement (лайки + комментарии выше медианы на 50%+) канала "${competitor.title}".

Выяви:
1) highEngagementThemes - темы, которые вызывают максимум реакций (лайки + комментарии)
2) engagingFormats - форматы видео, которые провоцируют аудиторию взаимодействовать
3) audiencePatterns - что общего у видео с высокой вовлеченностью
4) weakPoints - какие темы/форматы получают мало реакций (если видно из данных)
5) recommendations - конкретные рекомендации как повысить engagement
6) explanation - краткое объяснение почему эти темы получают высокий engagement

Видео с High Engagement:
${JSON.stringify(videosForAnalysis, null, 2)}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "highEngagementThemes": ["тема 1", "тема 2", ...],
  "engagingFormats": ["формат 1", "формат 2", ...],
  "audiencePatterns": ["паттерн 1", "паттерн 2", ...],
  "weakPoints": ["слабость 1", "слабость 2", ...],
  "recommendations": ["рекомендация 1", "рекомендация 2", ...],
  "explanation": "краткое объяснение..."
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

    console.log(`[Audience] Получен ответ от OpenAI`);

    // Парсим JSON ответ
    const aiAnalysis = JSON.parse(responseText);

    // Формируем итоговые данные
    const audienceData = {
      highEngagementVideos: highEngagementVideos.slice(0, 10).map(v => ({
        title: v.title,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
        engagementScore: v.engagementScore,
        likeRate: v.likeRate,
        commentRate: v.commentRate,
        publishedAt: v.publishedAt,
      })),
      stats: {
        totalAnalyzed: videos.length,
        highEngagement: highEngagementVideos.length,
        rising: videosWithMetrics.filter(v => v.category === "Rising").length,
        weak: videosWithMetrics.filter(v => v.category === "Weak").length,
        medianEngagement: medianEngagement,
      },
      ...aiAnalysis,
    };

    // Сохраняем результат в базу данных
    await db
      .insert(audienceInsights)
      .values({
        channelId: competitor.channelId,
        data: JSON.stringify(audienceData),
        generatedAt: Date.now(),
      })
      .run();

    console.log(`[Audience] Анализ сохранён в БД`);

    // Возвращаем результат клиенту
    return NextResponse.json({
      ...audienceData,
      generatedAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    console.error("[Audience] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate audience analysis" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/audience
 * Возвращает существующий audience анализ
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
      .from(audienceInsights)
      .where(eq(audienceInsights.channelId, competitor.channelId))
      .orderBy(desc(audienceInsights.generatedAt))
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
    console.error("[Audience] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch audience analysis" },
      { status: 500 }
    );
  }
}
