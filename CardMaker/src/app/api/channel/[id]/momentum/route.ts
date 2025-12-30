import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

interface VideoWithMomentum {
  id: number;
  videoId: string;
  title: string;
  viewCountInt: number;
  publishDate: string | null; // Может быть null если API не вернул дату
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
function daysSincePublish(publishDate: string): number {
  const date = new Date(publishDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

    console.log(`[Momentum] Запрос анализа для competitor ID: ${competitorId}`);

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

    console.log(`[Momentum] Канал найден: ${competitor.title}`);

    // Получаем последние 150 видео канала
    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channelId = ? ORDER BY publishDate DESC LIMIT 150",
      args: [competitor.channelId],
    });

    if (videosResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Sync Top Videos first" },
        { status: 400 }
      );
    }

    const videos = videosResult.rows;

    console.log(`[Momentum] Найдено ${videos.length} видео для анализа`);

    // Фильтруем видео с валидной датой публикации
    // (API может вернуть null если publishDate не был доступен)
    const videosWithValidDates = videos.filter((v: any) => {
      if (!v.publishDate) {
        console.warn(`[Momentum] Пропуск видео ${v.videoId} - нет даты публикации`);
        return false;
      }
      try {
        const date = new Date(v.publishDate);
        if (isNaN(date.getTime())) {
          console.warn(`[Momentum] Пропуск видео ${v.videoId} - невалидная дата: ${v.publishDate}`);
          return false;
        }
        return true;
      } catch {
        console.warn(`[Momentum] Пропуск видео ${v.videoId} - ошибка парсинга даты`);
        return false;
      }
    });

    console.log(`[Momentum] Видео с валидными датами: ${videosWithValidDates.length}/${videos.length}`);

    if (videosWithValidDates.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "No videos with valid publication dates" },
        { status: 400 }
      );
    }

    // Вычисляем views_per_day для каждого видео
    const videosWithMetrics: VideoWithMomentum[] = videosWithValidDates.map((v: any) => {
      const days = daysSincePublish(v.publishDate as string);
      const viewsPerDay = (v.viewCountInt as number) / days;

      return {
        id: v.id as number,
        videoId: v.videoId as string,
        title: v.title as string,
        viewCountInt: v.viewCountInt as number,
        publishDate: v.publishDate as string,
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

    // Реализуем fallback иерархию: high → rising → normal → top by views → empty
    let videosForAnalysis = videosWithMetrics
      .filter(v => v.category === "High Momentum")
      .sort((a, b) => b.momentumScore - a.momentumScore)
      .slice(0, 20);

    console.log(`[Momentum] High Momentum видео: ${videosForAnalysis.length}`);

    if (videosForAnalysis.length === 0) {
      console.info(`[Momentum] Fallback: нет High Momentum видео, пытаемся использовать Rising`);
      videosForAnalysis = videosWithMetrics
        .filter(v => v.category === "Rising")
        .sort((a, b) => b.momentumScore - a.momentumScore)
        .slice(0, 20);
      console.log(`[Momentum] Rising видео: ${videosForAnalysis.length}`);
    }

    if (videosForAnalysis.length === 0) {
      console.info(`[Momentum] Fallback: нет Rising видео, пытаемся использовать Normal`);
      videosForAnalysis = videosWithMetrics
        .filter(v => v.category === "Normal")
        .sort((a, b) => b.viewsPerDay - a.viewsPerDay)
        .slice(0, 20);
      console.log(`[Momentum] Normal видео: ${videosForAnalysis.length}`);
    }

    if (videosForAnalysis.length === 0) {
      console.info(`[Momentum] Fallback: нет Normal видео, пытаемся использовать top по views`);
      videosForAnalysis = videosWithMetrics
        .sort((a, b) => b.viewCountInt - a.viewCountInt)
        .slice(0, 20);
      console.log(`[Momentum] Top videos по views: ${videosForAnalysis.length}`);
    }

    // Если нет видео вообще - возвращаем empty state, не ошибку
    if (videosForAnalysis.length === 0) {
      console.info(`[Momentum] Empty state: нет видео для анализа`);
      client.close();
      return NextResponse.json({
        ok: true,
        data: null,
        reason: "insufficient_videos"
      }, { status: 200 });
    }

    console.log(`[MomentumInsights] Forced regen (limits disabled) - всегда генерируем свежий анализ`);
    console.log(`[Momentum] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI
    const videosForOpenAI = videosForAnalysis.map(v => ({
      title: v.title,
      viewCount: v.viewCountInt,
      viewsPerDay: Math.round(v.viewsPerDay),
      momentumScore: `${v.momentumScore >= 0 ? '+' : ''}${(v.momentumScore * 100).toFixed(0)}%`,
    }));

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
          content: "Ты — эксперт по анализу трендов YouTube. Твоя задача — выявить темы и форматы, которые растут прямо сейчас. ВАЖНО: Отвечай СТРОГО на русском языке. Возвращай JSON с английскими ключами, но ВСЕ значения должны быть на русском языке."
        },
        {
          role: "user",
          content: `Проанализируй список видео канала "${competitor.title}" на предмет трендов и паттернов.

Выяви:
1) hotThemes - основные темы, которые работают
2) hotFormats - форматы видео, которые работают лучше всего
3) hotIdeas - конкретные идеи для создания контента
4) explanation - краткое объяснение основных паттернов

Видео для анализа:
${JSON.stringify(videosForOpenAI, null, 2)}

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
    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(responseText);
    } catch (parseError) {
      const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`[Momentum] Failed to parse OpenAI response as JSON: ${parseErrorMsg}. Response: ${responseText.substring(0, 200)}`);
    }

    // Проверяем что aiAnalysis имеет необходимые поля
    if (!aiAnalysis || typeof aiAnalysis !== 'object') {
      throw new Error(`[Momentum] OpenAI response is not a valid object: ${responseText.substring(0, 100)}`);
    }

    if (!Array.isArray(aiAnalysis.hotThemes)) {
      throw new Error(`[Momentum] Missing or invalid hotThemes in OpenAI response`);
    }

    if (!Array.isArray(aiAnalysis.hotFormats)) {
      throw new Error(`[Momentum] Missing or invalid hotFormats in OpenAI response`);
    }

    if (!Array.isArray(aiAnalysis.hotIdeas)) {
      throw new Error(`[Momentum] Missing or invalid hotIdeas in OpenAI response`);
    }

    if (typeof aiAnalysis.explanation !== 'string') {
      throw new Error(`[Momentum] Missing or invalid explanation in OpenAI response`);
    }

    // Формируем итоговые данные
    const momentumData = {
      highMomentumVideos: videosForAnalysis.slice(0, 10).map(v => ({
        videoId: v.videoId,
        title: v.title,
        viewCount: v.viewCountInt,
        viewsPerDay: Math.round(v.viewsPerDay),
        momentumScore: v.momentumScore,
        publishDate: v.publishDate,
      })),
      stats: {
        totalAnalyzed: videos.length,
        highMomentum: videosWithMetrics.filter(v => v.category === "High Momentum").length,
        rising: videosWithMetrics.filter(v => v.category === "Rising").length,
        medianViewsPerDay: Math.round(medianViewsPerDay),
      },
      ...aiAnalysis,
    };

    const now = Date.now();

    // Сохраняем результат в базу данных (DELETE + INSERT для гарантированного обновления)
    // Удаляем старый анализ для этого канала
    await client.execute({
      sql: "DELETE FROM momentum_insights WHERE channelId = ?",
      args: [competitor.channelId],
    });

    // Вставляем свежий анализ
    await client.execute({
      sql: "INSERT INTO momentum_insights (channelId, data, data_ru, generatedAt) VALUES (?, ?, ?, ?)",
      args: [competitor.channelId, JSON.stringify(momentumData), null, now],
    });

    console.log(`[Momentum] Анализ сохранён в БД (свежая генерация)`);

    // Обновляем состояние пользователя: отмечаем, что он выполнил синхронизацию
    try {
      await client.execute({
        sql: `INSERT INTO user_channel_momentum_state (userId, channelId, hasShownMomentum, lastSyncAt)
              VALUES (?, ?, 0, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET lastSyncAt = ?`,
        args: [session.user.id, competitor.channelId, now, now],
      });
      console.log(`[Momentum] Обновлено состояние пользователя: lastSyncAt = ${new Date(now).toISOString()} для channelId=${competitor.channelId}`);
    } catch (stateError) {
      console.warn(`[Momentum] Ошибка при обновлении состояния пользователя:`, stateError instanceof Error ? stateError.message : stateError);
      // Не прерываем выполнение - анализ уже сохранён
    }

    client.close();

    // Возвращаем результат клиенту
    return NextResponse.json({
      ...momentumData,
      generatedAt: now,
    }, { status: 201 });

  } catch (error) {
    client.close();
    console.error("[Momentum] Ошибка:", error);

    if (error instanceof Error) {
      console.error("[Momentum] Stack:", error.stack);
    }

    const errorMessage = error instanceof Error
      ? (error.message || "Failed to generate momentum analysis")
      : String(error) || "Failed to generate momentum analysis";

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined
        })
      },
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

    // Получаем последний анализ
    const analysisResult = await client.execute({
      sql: "SELECT * FROM momentum_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const analysis = analysisResult.rows[0];
    let parsedData;
    try {
      parsedData = JSON.parse(analysis.data as string);
    } catch (parseError) {
      const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`[Momentum] Failed to parse stored momentum data as JSON: ${parseErrorMsg}`);
    }

    // Если в старых данных нет videoId, добавляем его из БД
    if (parsedData.highMomentumVideos && parsedData.highMomentumVideos.length > 0) {
      const needsVideoId = parsedData.highMomentumVideos.some((v: any) => !v.videoId);

      if (needsVideoId) {
        console.log('[Momentum] Обогащаем старые данные videoId из БД');

        // Получаем видео из БД по названиям
        const allVideosResult = await client.execute({
          sql: "SELECT * FROM channel_videos WHERE channelId = ?",
          args: [competitor.channelId],
        });

        // Создаём map title -> videoId для быстрого поиска
        const titleToVideoId = new Map(allVideosResult.rows.map(v => [v.title, v.videoId]));

        // Добавляем videoId к каждому видео
        parsedData.highMomentumVideos = parsedData.highMomentumVideos.map((v: any) => ({
          ...v,
          videoId: titleToVideoId.get(v.title) || ''
        }));
      }
    }

    client.close();

    return NextResponse.json({
      ...parsedData,
      generatedAt: analysis.generatedAt,
      hasRussianVersion: !!analysis.data_ru,
    });

  } catch (error) {
    client.close();
    console.error("[Momentum] Ошибка GET:", error);

    if (error instanceof Error) {
      console.error("[Momentum] GET Stack:", error.stack);
    }

    const errorMessage = error instanceof Error
      ? (error.message || "Failed to fetch momentum analysis")
      : String(error) || "Failed to fetch momentum analysis";

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { status: 500 }
    );
  }
}
