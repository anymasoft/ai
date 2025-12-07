import OpenAI from "openai";
import { createClient } from "@libsql/client";

/**
 * Детальный пункт SWOT-анализа
 */
export type SwotPoint = {
  title: string;        // короткий заголовок пункта
  details: string;      // мини-абзац (несколько предложений) раскрытия сути
};

/**
 * Идея для видео
 */
export type VideoIdea = {
  title: string;        // название будущего ролика
  hook: string;         // идея захода / крючок
  description: string;  // несколько предложений подробно: о чём ролик и почему он зайдёт
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
  strategicSummary: string[];  // 3–6 содержательных абзацев
  contentPatterns: string[];   // 3–7 абзацев о паттернах успешного контента
  videoIdeas: VideoIdea[];     // 3–7 осмысленных идей для новых видео
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
 * Вычисляет engagement score для видео
 */
function calculateEngagement(views: number, likes: number, comments: number): number {
  if (views === 0) return 0;
  return ((likes + comments * 2) / views) * 100;
}

/**
 * Форматирует длительность видео
 */
function formatDuration(duration: string | undefined): string {
  // Duration в формате ISO 8601 (PT1H2M10S)
  if (!duration) return 'н/д';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  } else if (minutes > 0) {
    return `${minutes}м ${seconds}с`;
  } else {
    return `${seconds}с`;
  }
}

/**
 * Анализирует YouTube канал с помощью OpenAI GPT-4o-mini
 * Создаёт глубокий SWOT-анализ с идеями для видео на основе реальных данных
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

    // Получаем топ-20 видео канала для анализа
    const videosResult = await dbClient.execute({
      sql: `SELECT * FROM channel_videos
            WHERE channelId = ?
            ORDER BY viewCount DESC
            LIMIT 20`,
      args: [competitor.channelId],
    });

    const videos = videosResult.rows.map(row => ({
      videoId: row.videoId as string,
      title: row.title as string,
      publishedAt: row.publishedAt as string,
      viewCount: row.viewCount as number,
      likeCount: row.likeCount as number,
      commentCount: row.commentCount as number,
      duration: row.duration as string | undefined,
      description: (row.data ? JSON.parse(row.data as string).snippet?.description : '') || '',
      engagement: calculateEngagement(
        row.viewCount as number,
        row.likeCount as number,
        row.commentCount as number
      ),
    }));

    // Получаем исторические метрики для анализа динамики
    const metricsResult = await dbClient.execute({
      sql: `SELECT * FROM channel_metrics
            WHERE channelId = ?
            ORDER BY fetchedAt DESC
            LIMIT 30`,
      args: [competitor.channelId],
    });

    const metrics = metricsResult.rows.map(row => ({
      subscriberCount: row.subscriberCount as number,
      videoCount: row.videoCount as number,
      viewCount: row.viewCount as number,
      date: row.date as string,
      fetchedAt: row.fetchedAt as number,
    }));

    dbClient.close();

    // Вычисляем агрегированные метрики
    const avgViews = videos.length > 0
      ? Math.round(videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length)
      : 0;

    const medianViews = videos.length > 0
      ? videos[Math.floor(videos.length / 2)].viewCount
      : 0;

    const avgDuration = videos.length > 0
      ? videos.reduce((sum, v) => {
          // Проверяем наличие duration перед использованием
          if (!v.duration) return sum;
          const match = v.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (!match) return sum;
          const hours = parseInt(match[1] || '0');
          const minutes = parseInt(match[2] || '0');
          const seconds = parseInt(match[3] || '0');
          return sum + hours * 3600 + minutes * 60 + seconds;
        }, 0) / videos.length
      : 0;

    // Анализ динамики роста
    let growthRate = 0;
    if (metrics.length >= 2) {
      const latest = metrics[0];
      const oldest = metrics[metrics.length - 1];
      const daysDiff = (latest.fetchedAt - oldest.fetchedAt) / (1000 * 60 * 60 * 24);
      if (daysDiff > 0) {
        growthRate = ((latest.subscriberCount - oldest.subscriberCount) / oldest.subscriberCount) * 100;
      }
    }

    // Формируем компактный блок данных для промпта
    const channelData = {
      общее: {
        название: competitor.title,
        подписчики: formatNumber(competitor.subscriberCount as number),
        видео: competitor.videoCount,
        просмотры: formatNumber(competitor.viewCount as number),
        средние_просмотры_на_видео: formatNumber(avgViews),
        медианные_просмотры: formatNumber(medianViews),
        средняя_длительность: `${Math.floor(avgDuration / 60)}м ${Math.floor(avgDuration % 60)}с`,
        рост_подписчиков: metrics.length >= 2 ? `${growthRate.toFixed(1)}%` : 'н/д',
      },
      топ_видео: videos.slice(0, 15).map((v, idx) => ({
        номер: idx + 1,
        название: v.title,
        опубликовано: new Date(v.publishedAt).toLocaleDateString('ru-RU'),
        просмотры: formatNumber(v.viewCount),
        лайки: formatNumber(v.likeCount),
        комментарии: formatNumber(v.commentCount),
        длительность: formatDuration(v.duration),
        вовлеченность: v.engagement.toFixed(3) + '%',
      })),
    };

    const prompt = `
Ты — эксперт по YouTube-стратегии и контент-маркетингу. Твоя задача — на основе РЕАЛЬНЫХ данных о канале и его лучших видео сделать глубокий SWOT-анализ и предложить КОНКРЕТНЫЕ сценарные идеи для будущих роликов.

**КРИТИЧЕСКИ ВАЖНО:**
- НЕ используй общие фразы типа "важно делать интересный контент"
- Строго опирайся на РЕАЛЬНЫЕ паттерны из данных: тематики, длительность, формат, заголовки, динамику просмотров
- Каждый пункт SWOT должен быть мини-абзацем (несколько предложений), а не одной фразой
- strategicSummary и contentPatterns — это содержательные, хорошо написанные абзацы
- videoIdeas должны быть осмысленными, с реальной пользой, основанными на успешных паттернах канала

**Данные канала и топ-видео:**
\`\`\`json
${JSON.stringify(channelData, null, 2)}
\`\`\`

**Верни результат СТРОГО в формате JSON:**

\`\`\`json
{
  "strengths": [
    {
      "title": "Краткий заголовок сильной стороны",
      "details": "Мини-абзац (3-5 предложений) с детальным анализом: конкретные цифры, примеры видео, почему это сильная сторона. НЕ одно предложение!"
    }
  ],
  "weaknesses": [
    {
      "title": "Краткий заголовок слабой стороны",
      "details": "Мини-абзац (3-5 предложений): в чём конкретно проблема, какие видео это показывают, как это влияет на метрики"
    }
  ],
  "opportunities": [
    {
      "title": "Краткий заголовок возможности",
      "details": "Мини-абзац (3-5 предложений): какую конкретно возможность видишь в данных, как её использовать, примеры"
    }
  ],
  "threats": [
    {
      "title": "Краткий заголовок угрозы",
      "details": "Мини-абзац (3-5 предложений): в чём конкретный риск, что показывают данные, как это может повлиять"
    }
  ],
  "strategicSummary": [
    "Абзац 1: Общая характеристика канала на основе метрик. Какова его текущая позиция, что говорит статистика о развитии.",
    "Абзац 2: Детальный анализ текущей ситуации и динамики. Что работает, что не работает, тренды в данных.",
    "Абзац 3: Ключевые выводы из SWOT-анализа. Главные инсайты из данных.",
    "Абзац 4: Конкретные рекомендации по стратегии развития на основе выявленных паттернов."
  ],
  "contentPatterns": [
    "Абзац 1: Детальное описание первого выявленного паттерна успешного контента (темы, форматы, длительность). С примерами конкретных видео из топа.",
    "Абзац 2: Второй важный паттерн с анализом метрик и примерами.",
    "Абзац 3: Третий паттерн или закономерность в успешных видео."
  ],
  "videoIdeas": [
    {
      "title": "Конкретное название идеи для видео, основанное на успешных паттернах",
      "hook": "Захватывающий крючок, который привлечёт внимание целевой аудитории",
      "description": "Подробное описание (4-6 предложений): о чём конкретно видео, почему оно зайдёт именно на этом канале (опираясь на паттерны топ-видео), какую проблему решает, какую ценность даёт зрителям.",
      "outline": [
        "Шаг 1: Конкретное вступление с крючком (30-60 сек)",
        "Шаг 2: Основная часть - детальное раскрытие темы",
        "Шаг 3: Примеры, кейсы или практическая демонстрация",
        "Шаг 4: Ключевые выводы и призыв к действию"
      ]
    }
  ]
}
\`\`\`

**Требования к ответу:**
1. 3-7 пунктов для каждой категории SWOT (strengths, weaknesses, opportunities, threats)
2. Каждый SwotPoint.details — это МИНИ-АБЗАЦ из 3-5 содержательных предложений, НЕ одно предложение!
3. strategicSummary — 3-6 связных, содержательных абзацев с реальными инсайтами
4. contentPatterns — 3-7 хорошо написанных абзацев о выявленных паттернах
5. videoIdeas — 3-7 ОСМЫСЛЕННЫХ идей с реальной пользой, не просто "ещё три заголовка"
6. Все идеи должны быть ПРАКТИЧНЫМИ и основаны на КОНКРЕТНЫХ паттернах из топ-видео
7. Отвечай ТОЛЬКО валидным JSON, без markdown и дополнительного текста
8. Весь текст на РУССКОМ языке
9. КРИТИЧНО: Не используй общие фразы! Каждый пункт должен ссылаться на конкретные данные канала!
`;

    console.log("[AI] Отправка детального промпта к OpenAI для SWOT-анализа:", competitor.handle);

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт по YouTube аналитике и контент-стратегии. Проводишь глубокий SWOT-анализ каналов, выявляешь КОНКРЕТНЫЕ паттерны успешного контента на основе РЕАЛЬНЫХ данных и даёшь практичные рекомендации. Всегда отвечаешь валидным JSON на русском языке. НИКОГДА не используешь общие фразы — только конкретика из данных.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 4096, // Увеличено для детального анализа
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

    // Дополнительная валидация: проверяем что details не пустые
    const validateSwotPoints = (points: SwotPoint[], category: string) => {
      points.forEach((point, idx) => {
        if (!point.title || !point.details) {
          throw new Error(`Invalid ${category} point at index ${idx}: missing title or details`);
        }
        if (point.details.length < 50) {
          console.warn(`Warning: ${category} point ${idx} has suspiciously short details (${point.details.length} chars)`);
        }
      });
    };

    validateSwotPoints(analysis.strengths, 'strengths');
    validateSwotPoints(analysis.weaknesses, 'weaknesses');
    validateSwotPoints(analysis.opportunities, 'opportunities');
    validateSwotPoints(analysis.threats, 'threats');

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
      avgDetailsLength: Math.round(
        [...analysis.strengths, ...analysis.weaknesses, ...analysis.opportunities, ...analysis.threats]
          .reduce((sum, p) => sum + p.details.length, 0) /
        (analysis.strengths.length + analysis.weaknesses.length + analysis.opportunities.length + analysis.threats.length)
      ),
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
