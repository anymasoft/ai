import OpenAI from "openai";
import { createClient } from "@libsql/client";

/**
 * Детальный пункт SWOT-анализа
 */
export type SwotPoint = {
  title: string;        // короткий заголовок пункта
  details: string;      // 2–5 предложений раскрытия сути
};

/**
 * Идея для видео
 */
export type VideoIdea = {
  title: string;        // название будущего ролика
  hook: string;         // идея захода / крючок
  description: string;  // 3–7 предложений подробно: о чём ролик и почему он зайдёт
  outline: string[];    // 3–7 пунктов структуры ролика (по шагам или по сценам)
};

/**
 * Полный SWOT-анализ канала
 */
export type ChannelSwotAnalysis = {
  strengths: SwotPoint[];
  weaknesses: SwotPoint[];
  opportunities: SwotPoint[];
  threats: SwotPoint[];
  strategicSummary: string[];  // 3–6 абзацев связного текста
  contentPatterns: string[];   // 3–7 абзацев/пунктов о том, какие паттерны работают
  videoIdeas: VideoIdea[];     // 3–7 идей для новых видео
  generatedAt: string;         // ISO-строка, время генерации
};

/**
 * Создаёт OpenAI клиент с API ключом из переменных окружения
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in environment variables");
  }

  return new OpenAI({ apiKey });
}

/**
 * Форматирует числа для читаемости (1000000 → 1M)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Анализирует YouTube канал с помощью OpenAI GPT-4o-mini
 * Создаёт детальный SWOT-анализ с идеями для видео
 */
export async function analyzeChannel(
  channelId: string
): Promise<ChannelSwotAnalysis> {
  const client = getOpenAIClient();

  // Подключаемся к БД для получения данных канала
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const dbClient = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    // Получаем данные канала
    const competitorResult = await dbClient.execute({
      sql: "SELECT * FROM competitors WHERE id = ?",
      args: [channelId],
    });

    if (competitorResult.rows.length === 0) {
      throw new Error("Channel not found");
    }

    const competitor = competitorResult.rows[0];

    // Получаем топ видео канала для анализа
    const videosResult = await dbClient.execute({
      sql: "SELECT * FROM channel_videos WHERE channelId = ? ORDER BY viewCount DESC LIMIT 20",
      args: [competitor.channelId],
    });

    const videos = videosResult.rows.map(row => ({
      title: row.title as string,
      viewCount: row.viewCount as number,
      likeCount: row.likeCount as number,
      commentCount: row.commentCount as number,
      duration: row.duration as string,
    }));

    dbClient.close();

    // Формируем детальный промпт для анализа
    const videosInfo = videos.length > 0
      ? videos.slice(0, 10).map((v, i) =>
          `${i + 1}. "${v.title}" - ${formatNumber(v.viewCount)} просмотров, ${formatNumber(v.likeCount)} лайков`
        ).join('\n')
      : "Данные о видео отсутствуют";

    const prompt = `
Проанализируй YouTube канал и предоставь ДЕТАЛЬНЫЙ SWOT-анализ с практическими рекомендациями.

**Данные канала:**
- Название: ${competitor.title}
- Handle: @${competitor.handle}
- Подписчиков: ${formatNumber(competitor.subscriberCount as number)}
- Видео: ${competitor.videoCount}
- Просмотров: ${formatNumber(competitor.viewCount as number)}

**Топ видео канала:**
${videosInfo}

**Задача:**
Создай глубокий SWOT-анализ канала в формате JSON со следующей структурой:

\`\`\`json
{
  "strengths": [
    {
      "title": "Краткий заголовок сильной стороны",
      "details": "Детальное описание (2-5 предложений) почему это сильная сторона канала"
    }
  ],
  "weaknesses": [
    {
      "title": "Краткий заголовок слабой стороны",
      "details": "Детальное описание (2-5 предложений) в чём проблема"
    }
  ],
  "opportunities": [
    {
      "title": "Краткий заголовок возможности",
      "details": "Детальное описание (2-5 предложений) как использовать эту возможность"
    }
  ],
  "threats": [
    {
      "title": "Краткий заголовок угрозы",
      "details": "Детальное описание (2-5 предложений) в чём риск"
    }
  ],
  "strategicSummary": [
    "Абзац 1: Общая характеристика канала и его позиционирования",
    "Абзац 2: Анализ текущей ситуации и динамики развития",
    "Абзац 3: Ключевые выводы из SWOT-анализа",
    "Абзац 4: Рекомендации по стратегии развития"
  ],
  "contentPatterns": [
    "Паттерн 1: Описание того, какие форматы/темы работают лучше всего",
    "Паттерн 2: Анализ успешных элементов контента",
    "Паттерн 3: Выявленные закономерности в популярных видео"
  ],
  "videoIdeas": [
    {
      "title": "Название идеи для видео",
      "hook": "Захватывающий крючок для привлечения внимания",
      "description": "Подробное описание (3-7 предложений): о чём видео, почему оно зайдёт, какую проблему решает",
      "outline": [
        "Шаг 1: Вступление и постановка проблемы",
        "Шаг 2: Основная часть",
        "Шаг 3: Примеры и кейсы",
        "Шаг 4: Выводы и призыв к действию"
      ]
    }
  ]
}
\`\`\`

**Требования:**
1. Создай 3-5 пунктов для каждой категории SWOT
2. strategicSummary должен содержать 3-6 связных абзацев
3. contentPatterns - 3-7 выявленных паттернов на основе топ видео
4. videoIdeas - 3-7 конкретных идей для новых видео
5. Все идеи должны быть ПРАКТИЧНЫМИ и основаны на данных канала
6. Отвечай ТОЛЬКО валидным JSON, без markdown и дополнительного текста
7. Весь текст на РУССКОМ языке
`;

    console.log("[AI] Отправка запроса к OpenAI для детального SWOT-анализа:", competitor.handle);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт по YouTube аналитике и контент-стратегии. Проводишь глубокий SWOT-анализ каналов, выявляешь паттерны успешного контента и даёшь практичные рекомендации. Всегда отвечаешь валидным JSON на русском языке.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[AI] Получен ответ от OpenAI, парсинг JSON...");

    // Парсим JSON ответ
    const analysis = JSON.parse(content) as ChannelSwotAnalysis;

    // Валидация структуры ответа
    if (
      !Array.isArray(analysis.strengths) ||
      !Array.isArray(analysis.weaknesses) ||
      !Array.isArray(analysis.opportunities) ||
      !Array.isArray(analysis.threats) ||
      !Array.isArray(analysis.strategicSummary) ||
      !Array.isArray(analysis.contentPatterns) ||
      !Array.isArray(analysis.videoIdeas)
    ) {
      throw new Error("Invalid analysis structure from OpenAI");
    }

    // Добавляем timestamp
    analysis.generatedAt = new Date().toISOString();

    console.log("[AI] Детальный SWOT-анализ успешно завершён:", {
      strengths: analysis.strengths.length,
      weaknesses: analysis.weaknesses.length,
      opportunities: analysis.opportunities.length,
      threats: analysis.threats.length,
      summaryParagraphs: analysis.strategicSummary.length,
      patterns: analysis.contentPatterns.length,
      videoIdeas: analysis.videoIdeas.length,
    });

    return analysis;
  } catch (error) {
    dbClient.close();
    console.error("[AI] Ошибка при детальном SWOT-анализе:", error);

    if (error instanceof Error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }

    throw new Error("AI analysis failed with unknown error");
  }
}
