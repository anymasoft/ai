import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, videoComments, commentInsights } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import OpenAI from "openai";

/**
 * POST /api/channel/[id]/comments/insights
 * Генерирует AI-анализ комментариев аудитории
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

    console.log(`[CommentInsights] Запрос анализа для competitor ID: ${competitorId}`);

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

    console.log(`[CommentInsights] Канал найден: ${competitor.title}`);

    // Получаем топ 15 видео канала
    const videos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .orderBy(desc(channelVideos.viewCount))
      .limit(15)
      .all();

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    const videoIds = videos.map((v) => v.videoId);

    console.log(`[CommentInsights] Найдено ${videos.length} видео`);

    // Получаем все комментарии для этих видео
    const comments = await db
      .select()
      .from(videoComments)
      .where(inArray(videoComments.videoId, videoIds))
      .orderBy(desc(videoComments.likes))
      .limit(500) // Топ 500 комментариев по лайкам
      .all();

    if (comments.length === 0) {
      return NextResponse.json(
        { error: "No comments found. Please sync comments first." },
        { status: 400 }
      );
    }

    console.log(`[CommentInsights] Найдено ${comments.length} комментариев для анализа`);

    // Проверяем, есть ли уже свежий анализ (не старше 3 дней)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const existingAnalysis = await db
      .select()
      .from(commentInsights)
      .where(eq(commentInsights.channelId, competitor.channelId))
      .orderBy(desc(commentInsights.generatedAt))
      .limit(1)
      .get();

    // Если анализ существует и свежий - возвращаем его
    if (existingAnalysis && existingAnalysis.generatedAt > threeDaysAgo) {
      console.log(`[CommentInsights] Найден свежий анализ`);
      return NextResponse.json({
        ...JSON.parse(existingAnalysis.data),
        generatedAt: existingAnalysis.generatedAt,
      });
    }

    console.log(`[CommentInsights] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI - берём топ 200 комментариев
    const topComments = comments.slice(0, 200).map((c) => ({
      content: c.content,
      likes: c.likes,
      authorName: c.authorName,
      isCreator: c.isCreator,
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
          content:
            "Ты — эксперт по анализу аудитории YouTube. Твоя задача — изучить комментарии и выявить интересы, боли, запросы и настроения аудитории.",
        },
        {
          role: "user",
          content: `Проанализируй топ комментарии на канале "${competitor.title}".

Выяви:
1) audienceInterests - основные интересы аудитории (темы, которые их волнуют)
2) audiencePainPoints - боли и проблемы, которые они испытывают
3) requestedTopics - темы, которые аудитория явно просит осветить
4) complaints - основные жалобы и недовольства
5) praises - что хвалят, что нравится
6) nextVideoIdeasFromAudience - конкретные идеи для следующих видео на основе комментариев
7) explanation - краткое объяснение общего настроя аудитории

Комментарии (${topComments.length} шт., отсортированы по лайкам):
${JSON.stringify(topComments, null, 2)}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "audienceInterests": ["интерес 1", "интерес 2", ...],
  "audiencePainPoints": ["боль 1", "боль 2", ...],
  "requestedTopics": ["запрос 1", "запрос 2", ...],
  "complaints": ["жалоба 1", "жалоба 2", ...],
  "praises": ["похвала 1", "похвала 2", ...],
  "nextVideoIdeasFromAudience": ["идея 1", "идея 2", ...],
  "explanation": "краткое объяснение..."
}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log(`[CommentInsights] Получен ответ от OpenAI`);

    // Парсим JSON ответ
    const aiAnalysis = JSON.parse(responseText);

    // Формируем итоговые данные
    const insightsData = {
      stats: {
        totalComments: comments.length,
        analyzedComments: topComments.length,
        totalVideos: videos.length,
      },
      ...aiAnalysis,
    };

    // Сохраняем результат в базу данных
    // Используем первое видео из списка как reference (можно использовать любое)
    await db
      .insert(commentInsights)
      .values({
        videoId: videos[0].videoId, // Reference video
        channelId: competitor.channelId,
        data: JSON.stringify(insightsData),
        generatedAt: Date.now(),
      })
      .run();

    console.log(`[CommentInsights] Анализ сохранён в БД`);

    // Возвращаем результат клиенту
    return NextResponse.json(
      {
        ...insightsData,
        generatedAt: Date.now(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CommentInsights] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate comment insights" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/comments/insights
 * Возвращает существующий анализ комментариев
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
      .from(commentInsights)
      .where(eq(commentInsights.channelId, competitor.channelId))
      .orderBy(desc(commentInsights.generatedAt))
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
    console.error("[CommentInsights] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch comment insights" },
      { status: 500 }
    );
  }
}
