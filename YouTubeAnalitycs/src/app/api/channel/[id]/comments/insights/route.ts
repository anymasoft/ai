import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

/**
 * POST /api/channel/[id]/comments/insights
 * Генерирует AI-анализ комментариев аудитории
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

    console.log(`[CommentInsights] Запрос анализа для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND user_id = ?",
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

    console.log(`[CommentInsights] Канал найден: ${competitor.title}`);

    // Получаем топ 15 видео канала
    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channel_id = ? ORDER BY view_count DESC LIMIT 15",
      args: [competitor.channel_id],
    });

    if (videosResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    const videos = videosResult.rows;
    const videoIds = videos.map((v) => v.video_id);

    console.log(`[CommentInsights] Найдено ${videos.length} видео`);

    // Получаем все комментарии для этих видео
    const placeholders = videoIds.map(() => "?").join(",");
    const commentsResult = await client.execute({
      sql: `SELECT * FROM video_comments WHERE video_id IN (${placeholders}) ORDER BY likes DESC LIMIT 500`,
      args: videoIds,
    });

    if (commentsResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "No comments found. Please sync comments first." },
        { status: 400 }
      );
    }

    const comments = commentsResult.rows;

    console.log(`[CommentInsights] Найдено ${comments.length} комментариев для анализа`);

    // Проверяем, есть ли уже свежий анализ (не старше 3 дней)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const existingAnalysisResult = await client.execute({
      sql: "SELECT * FROM comment_insights WHERE channel_id = ? ORDER BY generated_at DESC LIMIT 1",
      args: [competitor.channel_id],
    });

    // Если анализ существует и свежий - возвращаем его
    if (existingAnalysisResult.rows.length > 0) {
      const existingAnalysis = existingAnalysisResult.rows[0];
      if (existingAnalysis.generated_at > threeDaysAgo) {
        console.log(`[CommentInsights] Найден свежий анализ`);
        client.close();
        return NextResponse.json({
          ...JSON.parse(existingAnalysis.data as string),
          generatedAt: existingAnalysis.generated_at,
        });
      }
    }

    console.log(`[CommentInsights] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI - берём топ 200 комментариев
    const topComments = comments.slice(0, 200).map((c) => ({
      content: c.content,
      likes: c.likes,
      authorName: c.author_name,
      isCreator: c.is_creator,
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
    await client.execute({
      sql: "INSERT INTO comment_insights (video_id, channel_id, data, data_ru, generated_at) VALUES (?, ?, ?, ?, ?)",
      args: [videos[0].video_id, competitor.channel_id, JSON.stringify(insightsData), null, Date.now()],
    });

    console.log(`[CommentInsights] Анализ сохранён в БД`);

    client.close();

    // Возвращаем результат клиенту
    return NextResponse.json(
      {
        ...insightsData,
        generatedAt: Date.now(),
      },
      { status: 201 }
    );
  } catch (error) {
    client.close();
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

    // Получаем данные канала
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND user_id = ?",
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

    // Получаем последний анализ
    const analysisResult = await client.execute({
      sql: "SELECT * FROM comment_insights WHERE channel_id = ? ORDER BY generated_at DESC LIMIT 1",
      args: [competitor.channel_id],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const analysis = analysisResult.rows[0];

    client.close();

    return NextResponse.json({
      ...JSON.parse(analysis.data as string),
      generatedAt: analysis.generated_at,
      hasRussianVersion: !!analysis.data_ru,
    });
  } catch (error) {
    client.close();
    console.error("[CommentInsights] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch comment insights" },
      { status: 500 }
    );
  }
}
