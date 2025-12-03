import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, videoComments, channelAICommentInsights, users } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { analyzeChannelComments, type CommentForAnalysis, normalizeComments, chunkComments } from "@/lib/ai/comments-analysis";

/**
 * POST /api/channel/[id]/comments/ai
 * Генерирует глубокий AI-анализ комментариев канала (v2.0)
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

    console.log(`[DeepCommentAI] Запрос анализа для competitor ID: ${competitorId}`);

    // Получаем язык пользователя
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .get();

    const userLanguage = user?.language || "en";

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

    console.log(`[DeepCommentAI] Канал найден: ${competitor.title}, язык: ${userLanguage}`);

    // Получаем топ 30 видео канала
    const videos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .orderBy(desc(channelVideos.viewCount))
      .limit(30)
      .all();

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    const videoIds = videos.map((v) => v.videoId);

    console.log(`[DeepCommentAI] Найдено ${videos.length} видео`);

    // Получаем все комментарии для этих видео
    const comments = await db
      .select()
      .from(videoComments)
      .where(inArray(videoComments.videoId, videoIds))
      .orderBy(desc(videoComments.likes))
      .limit(1000) // Максимум 1000 комментариев
      .all();

    if (comments.length === 0) {
      return NextResponse.json(
        { error: "No comments found. Please sync comments first." },
        { status: 400 }
      );
    }

    console.log(`[DeepCommentAI] Найдено ${comments.length} комментариев для глубокого анализа`);

    // POST всегда генерирует новый анализ (даже если есть старый)
    // Пользователь нажал "Refresh Analysis" - значит хочет новый результат
    console.log(`[DeepCommentAI] Генерируем новый глубокий анализ через OpenAI...`);

    // Подготовка данных для анализа
    const commentsForAnalysis: CommentForAnalysis[] = comments.map((c) => ({
      content: c.content,
      likes: c.likes,
      authorName: c.authorName,
    }));

    // Предварительный расчёт количества чанков для прогресса
    const normalizedComments = normalizeComments(commentsForAnalysis);
    const chunks = chunkComments(normalizedComments);
    const totalChunks = chunks.length;

    console.log(`[DeepCommentAI] Будет обработано ${totalChunks} чанков комментариев`);

    // Создаём запись анализа со статусом 'pending' и известным progress_total
    await db
      .insert(channelAICommentInsights)
      .values({
        channelId: competitor.channelId,
        resultJson: JSON.stringify({}),
        createdAt: Date.now(),
        progress_current: 0,
        progress_total: totalChunks,
        status: 'pending',
      })
      .run();

    console.log(`[DeepCommentAI] Создана запись анализа: status='pending', progress=0/${totalChunks}`);

    // Вызов функции глубокого анализа с передачей channelId
    // EN is always the source of truth
    const analysisResult = await analyzeChannelComments(
      commentsForAnalysis,
      "en",
      competitor.channelId
    );

    console.log(`[DeepCommentAI] Анализ завершён успешно`);

    // Шаг 1: Находим id последней созданной записи
    const latestRecord = await db
      .select()
      .from(channelAICommentInsights)
      .where(eq(channelAICommentInsights.channelId, competitor.channelId))
      .orderBy(desc(channelAICommentInsights.createdAt))
      .limit(1)
      .get();

    if (!latestRecord) {
      console.error('[DeepCommentAI] No record found after creation');
      return NextResponse.json(
        { error: 'Failed to find created analysis record' },
        { status: 500 }
      );
    }

    // Шаг 2: Обновляем только эту конкретную запись по id
    // analysis_en - источник истины (всегда английский)
    await db
      .update(channelAICommentInsights)
      .set({
        resultJson: JSON.stringify(analysisResult),
        analysis_en: JSON.stringify(analysisResult), // Сохраняем английскую версию как источник
        analysis_ru: null, // Сброс русского перевода при пересчёте
        status: 'done',
      })
      .where(eq(channelAICommentInsights.id, latestRecord.id))
      .run();

    console.log(`[DeepCommentAI] Результат сохранён в БД для record id=${latestRecord.id} (analysis_en + resultJson)`);

    // Возвращаем результат клиенту
    return NextResponse.json(
      {
        ...analysisResult,
        cached: false,
        createdAt: Date.now(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DeepCommentAI] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate deep comment analysis" },
      { status: 500 }
    );
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

    // Получаем язык пользователя
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .get();

    const userLanguage = user?.language || "en";

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
      .from(channelAICommentInsights)
      .where(eq(channelAICommentInsights.channelId, competitor.channelId))
      .orderBy(desc(channelAICommentInsights.createdAt))
      .limit(1)
      .get();

    if (!analysis) {
      return NextResponse.json({ analysis: null });
    }

    // Выбираем нужную версию анализа в зависимости от языка пользователя
    let analysisData;
    let analysisLanguage = "en";
    let hasRussianVersion = false;

    if (userLanguage === "ru" && analysis.analysis_ru) {
      // Если пользователь хочет русский и он есть - возвращаем русский
      analysisData = JSON.parse(analysis.analysis_ru);
      analysisLanguage = "ru";
      hasRussianVersion = true;
    } else if (analysis.analysis_en) {
      // Иначе возвращаем английский (если он есть)
      analysisData = JSON.parse(analysis.analysis_en);
      hasRussianVersion = !!analysis.analysis_ru;
    } else {
      // Fallback на resultJson для старых записей
      analysisData = JSON.parse(analysis.resultJson);
      hasRussianVersion = !!analysis.analysis_ru;
    }

    return NextResponse.json({
      ...analysisData,
      cached: true,
      createdAt: analysis.createdAt,
      analysisLanguage,
      hasRussianVersion,
    });
  } catch (error) {
    console.error("[DeepCommentAI] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch deep comment analysis" },
      { status: 500 }
    );
  }
}
