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
Ты — эксперт YouTube-аналитики, креативный продюсер и стратег роста каналов.
Твоя задача — сделать максимально глубокий, практичный и коммерчески ценный SWOT-анализ канала,
используя предоставленные данные: метрики, темы, вовлеченность, паттерны контента, историю публикаций,
сильные/слабые стороны, возможности, угрозы, паттерны успешных видео, идеи конкурентов.

**Правила генерации:**
- НЕ используй общие фразы.
- Все выводы должны основываться на конкретных числах, паттернах и фактах.
- Пиши по-русски, но в профессиональном, ясном, стратегическом стиле.
- Делай текст максимально прикладным: "что делать", "почему", "какие результаты даст".

**Данные канала и топ-видео:**
\`\`\`json
${JSON.stringify(channelData, null, 2)}
\`\`\`

**Структура ответа (СТРОГО в этом формате JSON):**

\`\`\`json
{
  "strengths": [
    {
      "title": "Заголовок (2-5 слов)",
      "details": "1-2 насыщенных абзаца (200-300 символов). Конкретные цифры, примеры видео, связь с успехом. Не одна фраза!"
    }
  ],
  "weaknesses": [
    {
      "title": "Заголовок (2-5 слов)",
      "details": "1-2 абзаца (200-300 символов). Конкретная проблема, её влияние на метрики, как исправить."
    }
  ],
  "opportunities": [
    {
      "title": "Заголовок (2-5 слов)",
      "details": "1-2 абзаца (200-300 символов). Конкретная возможность, опирающаяся на тренды и паттерны топ-видео канала."
    }
  ],
  "threats": [
    {
      "title": "Заголовок (2-5 слов)",
      "details": "1-2 абзаца (200-300 символов). Стратегические риски с аргументацией. Строго по делу."
    }
  ],
  "strategicSummary": [
    "Абзац 1: Что из себя представляет канал, какие у него траектории роста.",
    "Абзац 2: Ключевый драйвер успеха и основной риск на основе данных.",
    "Абзац 3: 1-2 стратегические ниши, которые канал может занять.",
    "Абзац 4: Конкретные стратегические выводы и начальные шаги."
  ],
  "contentPatterns": [
    "Паттерн 1: Название, почему работает, какая аудитория реагирует, риск масштабирования.",
    "Паттерн 2: (аналогично)",
    "Паттерн 3-7: (остальные паттерны, если есть)"
  ],
  "videoIdeas": [
    {
      "title": "Конкретное название идеи на основе успешных паттернов",
      "hook": "1-2 фразы — захватывающий крючок",
      "description": "5-8 предложений: о чём видео, почему оно выстрелит именно на этом канале, на какую боль аудитории попадает, какую ценность даёт.",
      "outline": [
        "Шаг 1: Вступление с крючком",
        "Шаг 2-5: Основная логика видео",
        "Шаг 6: Выводы и call-to-action"
      ]
    }
  ]
}
\`\`\`

**КРИТИЧЕСКИ ВАЖНО:**
1. **Strengths, Weaknesses, Opportunities, Threats:** 5-12 пунктов КАЖДЫЙ (не 3-7).
   - Каждый пункт = 1-2 насыщенных абзаца (не одна фраза!).
   - Обязательна связь с конкретными цифрами, видео и паттернами.
   - Для Strengths: "как использовать эту силу для роста".
   - Для Weaknesses: "какой ущерб, как исправить".
   - Для Opportunities: опирайся на тренды YouTube, паттерны топ-видео.
   - Для Threats: стратегические риски, ниша, конкуренты, алгоритмы.

2. **strategicSummary:** 3-5 содержательных абзацев (не короче).
   - Позиция канала, траектория, ключевой драйвер, риск.
   - 1-2 стратегические ниши для захвата.

3. **contentPatterns:** 3-7 паттернов (каждый = 1-2 абзаца).
   - Определи успешные форматы/темы.
   - Почему работают, какая аудитория, риск масштабирования.

4. **videoIdeas:** 3-7 идей (не "ещё три заголовка").
   - Конкретные названия на основе паттернов.
   - Hook = 1-2 фразы (не описание).
   - Description = 5-8 предложений, практичные, с обоснованием.
   - Outline = 4-7 шагов структуры.

5. **Весь текст на РУССКОМ, без общих фраз, только конкретика.**
6. **Отвечай ТОЛЬКО JSON, без markdown-обёрток.**
7. **Это должен быть отчёт консультанта, стоящего 50-300 тыс. руб за аналитику.**
`;

    console.log("[AI] Отправка детального промпта к OpenAI для SWOT-анализа:", competitor.handle);

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт YouTube-аналитики, креативный продюсер и стратег роста каналов. Проводишь максимально глубокие, практичные и коммерчески ценные SWOT-анализы на основе РЕАЛЬНЫХ данных. Выявляешь конкретные паттерны, даёшь стратегические рекомендации, предлагаешь осмысленные идеи для контента. Отвечаешь ТОЛЬКО валидным JSON на русском. Никогда не используешь общие фразы — только конкретика, цифры, примеры.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 8000, // Увеличено для максимально детального анализа с 5-12 пунктами каждой категории
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
