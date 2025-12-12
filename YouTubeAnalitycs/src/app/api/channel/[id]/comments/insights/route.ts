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

    console.log(`[CommentInsights] Канал найден: ${competitor.title}`);

    // Получаем топ 15 видео канала
    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channelId = ? ORDER BY viewCountInt DESC LIMIT 15",
      args: [competitor.channelId],
    });

    if (videosResult.rows.length === 0) {
      console.info(`[CommentInsights] Empty state: нет видео для анализа`);
      client.close();
      return NextResponse.json({
        ok: true,
        data: null,
        reason: "insufficient_videos"
      }, { status: 200 });
    }

    const videos = videosResult.rows;
    const videoIds = videos.map((v) => v.videoId);

    console.log(`[CommentInsights] Найдено ${videos.length} видео`);

    // Получаем все комментарии для этих видео из глобальной таблицы
    const placeholders = videoIds.map(() => "?").join(",");
    const commentsResult = await client.execute({
      sql: `SELECT * FROM channel_comments WHERE videoId IN (${placeholders}) ORDER BY likeCountInt DESC LIMIT 500`,
      args: videoIds,
    });

    if (commentsResult.rows.length === 0) {
      console.info(`[CommentInsights] Empty state: нет комментариев для анализа`);
      client.close();
      return NextResponse.json({
        ok: true,
        data: null,
        reason: "insufficient_comments"
      }, { status: 200 });
    }

    const comments = commentsResult.rows;

    console.log(`[CommentInsights] Найдено ${comments.length} комментариев для анализа`);

    console.log(`[CommentInsights] Forced regen (limits disabled) - всегда генерируем свежий анализ`);
    console.log(`[CommentInsights] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI - берём топ 200 комментариев
    const topComments = comments.slice(0, 200).map((c) => ({
      content: c.text,
      likes: c.likeCountInt,
      authorName: c.author,
    }));

    console.log(`[CommentInsights] topComments prepared: ${topComments.length} comments`);
    if (topComments.length > 0) {
      console.log(`[CommentInsights] First comment sample:`, topComments[0]);
    }

    // Инициализация OpenAI клиента
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Вызов OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт по анализу аудитории YouTube. Твоя задача — изучить комментарии и выявить интересы, боли, запросы и настроения аудитории. ВАЖНО: Отвечай СТРОГО на русском языке. Возвращай JSON с английскими ключами, но ВСЕ значения должны быть на русском языке.",
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
    console.log(`[CommentInsights] Raw response from OpenAI:`, responseText);

    // Парсим JSON ответ
    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(responseText);
    } catch (parseErr) {
      console.error(`[CommentInsights] JSON parse error:`, parseErr);
      console.error(`[CommentInsights] Response text:`, responseText);
      throw new Error(`Failed to parse OpenAI response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
    }

    console.log(`[CommentInsights] Parsed AI analysis:`, JSON.stringify(aiAnalysis, null, 2));

    // Валидируем структуру ответа от OpenAI
    const validatedAnalysis = {
      audienceInterests: Array.isArray(aiAnalysis.audienceInterests) ? aiAnalysis.audienceInterests : [],
      audiencePainPoints: Array.isArray(aiAnalysis.audiencePainPoints) ? aiAnalysis.audiencePainPoints : [],
      requestedTopics: Array.isArray(aiAnalysis.requestedTopics) ? aiAnalysis.requestedTopics : [],
      complaints: Array.isArray(aiAnalysis.complaints) ? aiAnalysis.complaints : [],
      praises: Array.isArray(aiAnalysis.praises) ? aiAnalysis.praises : [],
      nextVideoIdeasFromAudience: Array.isArray(aiAnalysis.nextVideoIdeasFromAudience) ? aiAnalysis.nextVideoIdeasFromAudience : [],
      explanation: typeof aiAnalysis.explanation === "string" ? aiAnalysis.explanation : "No explanation provided",
    };

    console.log(`[CommentInsights] Validated analysis:`, JSON.stringify(validatedAnalysis, null, 2));

    // Формируем итоговые данные
    const insightsData = {
      stats: {
        totalComments: comments.length,
        analyzedComments: topComments.length,
        totalVideos: videos.length,
      },
      ...validatedAnalysis,
    };

    console.log(`[CommentInsights] Final insightsData структура:`, {
      hasStats: !!insightsData.stats,
      hasAudienceInterests: !!insightsData.audienceInterests,
      audienceInterestsCount: insightsData.audienceInterests?.length || 0,
      hasComplaints: !!insightsData.complaints,
      complaintsCount: insightsData.complaints?.length || 0,
      hasPraises: !!insightsData.praises,
      praisesCount: insightsData.praises?.length || 0,
    });

    const now = Date.now();

    // Сохраняем результат в базу данных (DELETE + INSERT для гарантированного обновления)
    // Удаляем старый анализ для этого канала и пользователя
    await client.execute({
      sql: "DELETE FROM comment_insights WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Вставляем свежий анализ
    const serializedData = JSON.stringify(insightsData);
    console.log(`[CommentInsights] Сериализованные данные для БД (первые 200 символов):`, serializedData.substring(0, 200));

    await client.execute({
      sql: "INSERT INTO comment_insights (userId, videoId, channelId, data, data_ru, generatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [session.user.id, videos[0].videoId, competitor.channelId, serializedData, null, now],
    });

    console.log(`[CommentInsights] Анализ сохранён в БД (свежая генерация)`);

    client.close();

    // Формируем финальный ответ клиенту
    const responseData = {
      ...insightsData,
      generatedAt: now,
    };

    console.log(`[CommentInsights] Отправляем клиенту ответ с структурой:`, {
      hasStats: !!responseData.stats,
      audienceInterestsCount: responseData.audienceInterests?.length || 0,
      generatedAt: responseData.generatedAt,
    });

    // Возвращаем результат клиенту
    return NextResponse.json(responseData, { status: 201 });
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

    // Получаем последний анализ пользователя
    const analysisResult = await client.execute({
      sql: "SELECT * FROM comment_insights WHERE userId = ? AND channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [session.user.id, competitor.channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const analysis = analysisResult.rows[0];

    client.close();

    return NextResponse.json({
      ...JSON.parse(analysis.data as string),
      generatedAt: analysis.generatedAt,
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
