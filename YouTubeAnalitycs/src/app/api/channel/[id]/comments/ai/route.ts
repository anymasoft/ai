import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { type CommentForAnalysis, normalizeComments } from "@/lib/ai/comments-analysis";
import { analyzeCommentsWithOrchestrator } from "@/lib/ai/comments-orchestrator";

/**
 * POST /api/channel/[id]/comments/ai
 * Генерирует глубокий AI-анализ комментариев канала (v2.0)
 * НИКОГДА не падает, всегда возвращает JSON.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let client = null;
  let channelId: string | null = null;
  let recordId: number | null = null;

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

    console.log(`[DeepCommentAI] Запрос анализа для competitor ID: ${competitorId}`);

    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем данные канала
    const competitorResult = await client.execute({
      sql: `SELECT channelId, title FROM competitors WHERE id = ? AND userId = ?`,
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    channelId = competitorResult.rows[0].channelId as string;
    const channelTitle = competitorResult.rows[0].title as string;

    console.log(`[DeepCommentAI] Канал найден: ${channelTitle}`);

    // Получаем топ 30 видео
    const videosResult = await client.execute({
      sql: `SELECT videoId FROM channel_videos
            WHERE channelId = ?
            ORDER BY viewCount DESC
            LIMIT 30`,
      args: [channelId],
    });

    if (videosResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Sync Top Videos first" },
        { status: 400 }
      );
    }

    const videoIds = videosResult.rows.map((v) => v.videoId as string);

    console.log(`[DeepCommentAI] Найдено ${videosResult.rows.length} видео`);

    // Получаем комментарии
    const placeholders = videoIds.map(() => "?").join(",");
    const commentsResult = await client.execute({
      sql: `SELECT content, likes, authorName FROM video_comments
            WHERE videoId IN (${placeholders})
            ORDER BY likes DESC
            LIMIT 1000`,
      args: videoIds,
    });

    if (commentsResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Sync Comments first" },
        { status: 400 }
      );
    }

    console.log(`[DeepCommentAI] Найдено ${commentsResult.rows.length} комментариев`);

    // Подготовка данных для анализа
    const commentsForAnalysis: CommentForAnalysis[] = commentsResult.rows.map((c) => ({
      content: c.content as string,
      likes: c.likes as number,
      authorName: c.authorName as string,
    }));

    console.log(`[DeepCommentAI] Подготовлено ${commentsForAnalysis.length} комментариев для анализа`);

    // Создаём запись анализа
    await client.execute({
      sql: `INSERT INTO channel_ai_comment_insights
            (channelId, resultJson, createdAt, progress_current, progress_total, status)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [channelId, JSON.stringify({}), Date.now(), 0, 10, 'pending'],
    });

    console.log(`[DeepCommentAI] Создана запись анализа: status='pending'`);

    // Находим id созданной записи
    const latestResult = await client.execute({
      sql: `SELECT id FROM channel_ai_comment_insights
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    if (latestResult.rows.length === 0) {
      console.error('[DeepCommentAI] No record found after creation');
      return NextResponse.json(
        { error: 'Failed to find created analysis record' },
        { status: 500 }
      );
    }

    recordId = latestResult.rows[0].id as number;

    // Генерация анализа через новый orchestrator (все 10 модулей параллельно)
    const analysisResult = await analyzeCommentsWithOrchestrator(
      commentsForAnalysis,
      "ru"
    );

    console.log(`[DeepCommentAI] Анализ завершён успешно`);

    // Обновляем запись: сохраняем результат
    await client.execute({
      sql: `UPDATE channel_ai_comment_insights
            SET resultJson = ?, status = 'done'
            WHERE id = ?`,
      args: [JSON.stringify(analysisResult), recordId],
    });

    console.log(`[DeepCommentAI] Результат сохранён`);

    return NextResponse.json(
      {
        ...analysisResult,
        cached: false,
        createdAt: Date.now(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ai route crash]", error);

    // Если есть channelId, обновляем статус на error
    if (client && channelId) {
      try {
        await client.execute({
          sql: `UPDATE channel_ai_comment_insights
                SET status = 'error'
                WHERE channelId = ? AND (status = 'pending' OR status = 'processing')`,
          args: [channelId],
        });
        console.log(`[ai route] Updated progress to error for channel ${channelId}`);
      } catch (updateError) {
        console.error("[ai route] Failed to update error status:", updateError);
      }
    }

    // Определяем статус ошибки и сообщение
    let errorMessage = "Failed to analyze comments";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes("No valid comments")) {
        errorMessage = "Not enough valid comments to analyze";
        statusCode = 400;
      } else if (error.message.includes("failed") || error.message.includes("Failed")) {
        errorMessage = "Analysis failed: " + error.message;
        statusCode = 400;
      }
    }

    // Всегда возвращаем JSON, даже при ошибке
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  } finally {
    if (client) {
      try {
        client.close();
      } catch (closeError) {
        console.error("[ai route] Failed to close client:", closeError);
      }
    }
  }
}

/**
 * GET /api/channel/[id]/comments/ai
 * Возвращает существующий глубокий AI-анализ комментариев
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

    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем данные канала
    const competitorResult = await client.execute({
      sql: `SELECT channelId FROM competitors WHERE id = ? AND userId = ?`,
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    const channelId = competitorResult.rows[0].channelId as string;

    // Получаем последний анализ
    const analysisResult = await client.execute({
      sql: `SELECT resultJson, createdAt
            FROM channel_ai_comment_insights
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const row = analysisResult.rows[0];
    const resultJson = row.resultJson as string | null;
    const createdAt = row.createdAt as number;

    client.close();

    if (!resultJson) {
      return NextResponse.json({ analysis: null });
    }

    const parsedResult = JSON.parse(resultJson);

    return NextResponse.json({
      ...parsedResult,
      cached: true,
      createdAt: createdAt,
    });
  } catch (error) {
    console.error("[DeepCommentAI] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch deep comment analysis" },
      { status: 500 }
    );
  }
}
