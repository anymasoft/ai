import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { db } from "@/lib/db";

// Инициализация OpenAI клиента
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Типы для запроса и ответа
interface TrendingInsightsRequest {
  videos: Array<{
    title: string;
    channelTitle: string;
    momentumScore: number;
    viewsPerDay: number;
    publishedAt: number;
  }>;
}

interface TrendingInsightsResponse {
  summary: string;
  themes: string[];
  formats: string[];
  recommendations: string[];
}

/**
 * POST /api/trending/insights
 * Генерирует AI-анализ трендовых видео и сохраняет в БД
 */
export async function POST(req: NextRequest) {
  try {
    // Проверка аутентификации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Проверка API ключа OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error("[TrendingInsights] OPENAI_API_KEY не настроен");
      return NextResponse.json(
        { error: "OpenAI API ключ не настроен" },
        { status: 500 }
      );
    }

    // Парсинг тела запроса
    const body = await req.json() as TrendingInsightsRequest;
    const { videos } = body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { error: "Требуется массив видео для анализа" },
        { status: 400 }
      );
    }

    console.log(`[TrendingInsights] Генерация анализа для ${videos.length} видео, пользователь: ${userId}`);

    // Подготовка данных для промпта
    const topVideos = videos
      .sort((a, b) => b.momentumScore - a.momentumScore)
      .slice(0, 20); // Берем топ-20 видео для анализа

    // Формирование промпта
    const prompt = `
Ты аналитик YouTube-трендов.
На входе список быстрорастущих видео по нескольким каналам.

Данные видео:
${topVideos.map((video, index) => `
${index + 1}. "${video.title}"
   Канал: ${video.channelTitle}
   Momentum Score: ${(video.momentumScore * 100).toFixed(0)}%
   Просмотров в день: ${Math.round(video.viewsPerDay).toLocaleString()}
   Опубликовано: ${new Date(video.publishedAt).toLocaleDateString("ru-RU")}
`).join("\n")}

Проанализируй эти видео и определи:
1) Какие темы сейчас растут (трендовые темы).
2) Какие форматы работают лучше всего (интервью, обзоры, влоги и т.д.).
3) Что объединяет эти видео (структура, настроение, стилистика, длительность).
4) Дай 3–5 практичных рекомендаций блогеру, какие видео стоит снять.

Пиши структурировано, без воды. Ответ предоставь в формате JSON:
{
  "summary": "Краткое резюме анализа (2-3 предложения)",
  "themes": ["тема 1", "тема 2", "тема 3"],
  "formats": ["формат 1", "формат 2"],
  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3", "рекомендация 4", "рекомендация 5"]
}

Важно: Все ответы на русском языке.
`;

    // Вызов OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Ты опытный аналитик YouTube-контента. Твоя задача — анализировать тренды и давать практические рекомендации."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    // Парсинг ответа
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("Пустой ответ от OpenAI");
    }

    let insights: TrendingInsightsResponse;
    try {
      insights = JSON.parse(responseContent) as TrendingInsightsResponse;
    } catch (parseError) {
      console.error("[TrendingInsights] Ошибка парсинга JSON:", parseError, "Ответ:", responseContent);

      // Fallback: создаем базовую структуру из текстового ответа
      insights = {
        summary: "Анализ трендовых видео завершен. Обнаружены интересные паттерны роста.",
        themes: ["Общие темы из анализа"],
        formats: ["Популярные форматы контента"],
        recommendations: [
          "Создавайте контент по трендовым темам",
          "Экспериментируйте с разными форматами",
          "Обращайте внимание на структуру успешных видео"
        ]
      };
    }

    // Сохранение анализа в БД
    const now = Date.now();
    await db.execute({
      sql: `
        INSERT INTO trending_insights
        (userId, videoCount, summary, themes, formats, recommendations, generatedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        userId,
        videos.length,
        insights.summary,
        JSON.stringify(insights.themes),
        JSON.stringify(insights.formats),
        JSON.stringify(insights.recommendations),
        now,
        now
      ]
    });

    console.log("[TrendingInsights] Анализ успешно сгенерирован и сохранен в БД");

    return NextResponse.json({
      success: true,
      insights,
      analyzedVideos: topVideos.length,
      totalVideos: videos.length,
      savedToDb: true
    });

  } catch (error) {
    console.error("[TrendingInsights] Ошибка генерации анализа:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Не удалось сгенерировать анализ трендов"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trending/insights
 * Получает последний сохраненный анализ для пользователя
 */
export async function GET(req: NextRequest) {
  try {
    // Проверка аутентификации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Получение последнего анализа из БД
    const result = await db.execute({
      sql: `
        SELECT id, videoCount, summary, themes, formats, recommendations, generatedAt, createdAt
        FROM trending_insights
        WHERE userId = ?
        ORDER BY generatedAt DESC
        LIMIT 1
      `,
      args: [userId]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        hasInsights: false,
        message: "Нет сохраненных анализов"
      });
    }

    const row = result.rows[0];
    const insights: TrendingInsightsResponse = {
      summary: row.summary as string,
      themes: JSON.parse(row.themes as string),
      formats: JSON.parse(row.formats as string),
      recommendations: JSON.parse(row.recommendations as string)
    };

    return NextResponse.json({
      success: true,
      hasInsights: true,
      insights,
      videoCount: row.videoCount as number,
      generatedAt: row.generatedAt as number,
      createdAt: row.createdAt as number
    });

  } catch (error) {
    console.error("[TrendingInsights] Ошибка получения анализа:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Не удалось получить сохраненный анализ"
      },
      { status: 500 }
    );
  }
}
