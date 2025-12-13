import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import type { GeneratedScript, SavedScript } from "@/types/scripts";

// ============================================================================
// УТИЛИТЫ
// ============================================================================

/**
 * Парсит videoId из различных форматов YouTube URL
 * Поддерживает:
 * - https://www.youtube.com/watch?v=VIDEOID
 * - https://youtu.be/VIDEOID
 * - https://www.youtube.com/shorts/VIDEOID
 */
function parseYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  // Формат: https://youtu.be/VIDEOID
  let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // Формат: https://www.youtube.com/watch?v=VIDEOID или с доп параметрами
  match = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // Формат: https://www.youtube.com/shorts/VIDEOID
  match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  return null;
}

/**
 * Получает RAW данные видео с YouTube через Scrapecreators API
 * Возвращает данные в формате для вставки в channel_videos таблицу
 */
async function fetchYouTubeVideoData(
  youtubeUrl: string,
  videoId: string
): Promise<{
  id: string;
  title: string;
  channelId?: string;
  viewCountInt: number;
  likeCountInt?: number;
  commentCountInt?: number;
  publishDate: string;
} | null> {
  try {
    const apiKey = process.env.SCRAPECREATORS_API_KEY;
    if (!apiKey) {
      console.warn("[YouTubeVideoFetch] SCRAPECREATORS_API_KEY not configured");
      return null;
    }

    const response = await fetch(
      `https://api.scrapecreators.com/v1/youtube/video?url=${encodeURIComponent(youtubeUrl)}`,
      {
        headers: { "x-api-key": apiKey },
        timeout: 10000,
      }
    );

    if (!response.ok) {
      console.warn(`[YouTubeVideoFetch] API returned status ${response.status}`);
      return null;
    }

    const data = await response.json() as any;

    if (!data.id || !data.title) {
      console.warn("[YouTubeVideoFetch] Incomplete video data from API");
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      channelId: data.channel?.id || data.channelId,
      viewCountInt: data.viewCountInt || 0,
      likeCountInt: data.likeCountInt,
      commentCountInt: data.commentCountInt,
      publishDate: data.publishDate || new Date().toISOString(),
    };
  } catch (error) {
    console.error("[YouTubeVideoFetch] Error:", error);
    return null;
  }
}

// ============================================================================
// ТИПЫ ДЛЯ МНОГОШАГОВОГО PIPELINE
// ============================================================================

/**
 * Данные видео для генерации сценария
 */
type VideoForScript = {
  id: string;
  title: string;
  channelTitle: string;
  channelHandle?: string;
  tags?: string[];
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  viewsPerDay: number;
  momentumScore: number;
  publishDate: string;
};

/**
 * Семантическая карта - результат анализа видео
 */
type SemanticMap = {
  mergedTopics: string[];        // объединённые темы из названий видео
  commonPatterns: string[];      // повторяющиеся паттерны
  conflicts: string[];           // конфликты идей / интересов
  paradoxes: string[];           // парадоксы / противоречия
  emotionalSpikes: string[];     // эмоциональные точки / триггеры
  visualMotifs: string[];        // визуальные образы / сцены
  audienceInterests: string[];   // что явно интересно аудитории
  rawSummary: string;            // общий текстовый обзор ситуации
};

/**
 * Нарративный скелет - каркас будущего сценария
 */
type NarrativeSkeleton = {
  coreIdea: string;              // главная идея сценария
  centralParadox: string;        // центральный парадокс
  mainConflict: string;          // главный конфликт
  mainQuestion: string;          // главный вопрос для зрителя
  emotionalBeats: string[];      // ключевые эмоциональные моменты
  storyBeats: string[];          // последовательность крупных блоков
  visualMotifs: string[];        // визуальные мотивы
  hookCandidates: string[];      // варианты хука
  endingIdeas: string[];         // варианты концовки
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Рассчитывает количество дней с момента публикации видео
 */
function daysSincePublish(publishDate: string): number {
  const date = new Date(publishDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.max(1, diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Рассчитывает медиану массива чисел
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

// ============================================================================
// ШАГ 1: СБОР ДАННЫХ ПО ВИДЕО
// ============================================================================

/**
 * Собирает данные о видео из БД по списку ID
 * @param selectedVideoIds - массив videoId для анализа
 * @param userId - ID пользователя (для проверки доступа)
 */
async function collectVideoData(
  selectedVideoIds: string[],
  userId: string
): Promise<VideoForScript[]> {
  if (selectedVideoIds.length === 0) {
    return [];
  }

  // Получаем каналы пользователя для маппинга channelId -> title/handle
  const competitorsResult = await db.execute({
    sql: `SELECT channelId, title, handle FROM competitors WHERE userId = ?`,
    args: [userId],
  });

  const channelMap = new Map<string, { title: string; handle?: string }>();
  competitorsResult.rows.forEach(row => {
    channelMap.set(row.channelId as string, {
      title: row.title as string,
      handle: row.handle as string | undefined,
    });
  });

  // Получаем видео по ID
  const placeholders = selectedVideoIds.map(() => "?").join(",");
  const videosResult = await db.execute({
    sql: `
      SELECT
        videoId, channelId, title, viewCountInt, likeCountInt, commentCountInt, publishDate
      FROM channel_videos
      WHERE videoId IN (${placeholders})
    `,
    args: selectedVideoIds,
  });

  if (videosResult.rows.length === 0) {
    return [];
  }

  // Рассчитываем viewsPerDay для всех видео
  const videosWithMetrics = videosResult.rows.map(row => {
    const viewCount = Number(row.viewCountInt) || 0;
    const publishDate = row.publishDate as string;
    const days = daysSincePublish(publishDate);
    const viewsPerDay = viewCount / days;

    return {
      videoId: row.videoId as string,
      channelId: row.channelId as string,
      title: row.title as string,
      viewCount,
      likeCount: row.likeCountInt ? Number(row.likeCountInt) : undefined,
      commentCount: row.commentCountInt ? Number(row.commentCountInt) : undefined,
      publishDate,
      viewsPerDay,
    };
  });

  // Рассчитываем медиану и momentumScore
  const viewsPerDayValues = videosWithMetrics.map(v => v.viewsPerDay);
  const medianViewsPerDay = calculateMedian(viewsPerDayValues);

  // Формируем финальный результат
  const videos: VideoForScript[] = videosWithMetrics.map(video => {
    const channelInfo = channelMap.get(video.channelId);
    const momentumScore = medianViewsPerDay > 0
      ? (video.viewsPerDay / medianViewsPerDay) - 1
      : 0;

    return {
      id: video.videoId,
      title: video.title,
      channelTitle: channelInfo?.title || "Unknown Channel",
      channelHandle: channelInfo?.handle,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      viewsPerDay: Math.round(video.viewsPerDay),
      momentumScore: Math.round(momentumScore * 100) / 100,
      publishDate: video.publishDate,
    };
  });

  console.log(`[ScriptGenerate] Собрано ${videos.length} видео для анализа`);
  return videos;
}

// ============================================================================
// ШАГ 2: ГЕНЕРАЦИЯ СЕМАНТИЧЕСКОЙ КАРТЫ (GPT-ЭТАП 1)
// ============================================================================

/**
 * Системный промпт для генерации SemanticMap
 */
const SEMANTIC_MAP_SYSTEM_PROMPT = `Ты — аналитик YouTube и контент-стратег.
Тебе дают список популярных видео конкурентов с их названиями, метриками и тегами.

Твоя задача — проанализировать их и создать структурированную Semantic Map (семантическую карту) для будущего сценария.

ВАЖНО:
- НЕ пиши сценарий. Твоя задача — только АНАЛИЗ.
- Отвечай СТРОГО на русском языке.
- Возвращай ТОЛЬКО валидный JSON без markdown-обёрток, без комментариев, без пояснений.
- Все значения в JSON должны быть на русском языке.`;

/**
 * Генерирует семантическую карту на основе данных видео через OpenAI GPT
 * Это GPT-ЭТАП 1 pipeline - анализ и объединение данных
 */
async function generateSemanticMap(videos: VideoForScript[]): Promise<SemanticMap> {
  console.log(`[SemanticMap] Начинаем GPT-анализ ${videos.length} видео...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Подготавливаем компактные данные для GPT
  const videosData = videos.map(v => ({
    title: v.title,
    channel: v.channelTitle,
    views: v.viewCount,
    viewsPerDay: v.viewsPerDay,
    momentum: v.momentumScore,
    tags: v.tags?.slice(0, 5) || [],
  }));

  // Формируем user prompt
  const userPrompt = `Проанализируй следующие популярные видео конкурентов и создай Semantic Map.

ДАННЫЕ ВИДЕО:
${JSON.stringify(videosData, null, 2)}

ЗАДАЧА:
Проанализируй все видео и выдели:

1. **mergedTopics** (5-10 штук) — объединённые темы, которые прослеживаются во всех видео. Не просто слова из названий, а СМЫСЛОВЫЕ темы (например: "личностный рост", "денежное мышление", "преодоление страхов").

2. **commonPatterns** (5-8 штук) — повторяющиеся паттерны успеха: что общего у этих видео? (структура названий, триггерные слова, форматы подачи, длина, стиль).

3. **conflicts** (3-5 штук) — конфликты и противоречия, которые можно использовать в сценарии (старое vs новое, эксперты vs новички, мифы vs реальность).

4. **paradoxes** (2-4 штуки) — парадоксы и контринтуитивные идеи, которые цепляют внимание (чем больше работаешь — тем меньше зарабатываешь, и т.п.).

5. **emotionalSpikes** (4-6 штук) — эмоциональные точки и триггеры, которые вызывают сильную реакцию аудитории (страх упустить, желание статуса, боль от неудач).

6. **visualMotifs** (3-5 штук) — визуальные образы и сцены, которые можно использовать в видео (роскошная жизнь, трансформация до/после, момент озарения).

7. **audienceInterests** (4-6 штук) — что явно интересует аудиторию этих каналов, на что они реагируют.

8. **rawSummary** — общий текстовый обзор ситуации (2-3 предложения): какой контент популярен, почему, какие возможности для нового видео.

Верни ТОЛЬКО JSON в формате:
{
  "mergedTopics": ["тема 1", "тема 2", ...],
  "commonPatterns": ["паттерн 1", "паттерн 2", ...],
  "conflicts": ["конфликт 1", "конфликт 2", ...],
  "paradoxes": ["парадокс 1", "парадокс 2", ...],
  "emotionalSpikes": ["триггер 1", "триггер 2", ...],
  "visualMotifs": ["образ 1", "образ 2", ...],
  "audienceInterests": ["интерес 1", "интерес 2", ...],
  "rawSummary": "Общий обзор..."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SEMANTIC_MAP_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    // Логгирование GPT-ответа
    console.log("[GPT semantic] finish_reason:", completion.choices[0]?.finish_reason);
    console.log("[GPT semantic] usage:", completion.usage);

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("Пустой ответ от OpenAI при генерации SemanticMap");
    }

    console.log(`[SemanticMap] Получен ответ от OpenAI (${responseText.length} символов)`);

    // Парсим JSON с очисткой от возможных markdown-обёрток
    let semanticData: SemanticMap;
    try {
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      semanticData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("[SemanticMap] Ошибка парсинга JSON:", parseError);
      console.error("[SemanticMap] Raw response:", responseText);
      throw new Error("Ошибка парсинга SemanticMap от OpenAI");
    }

    // Валидируем и нормализуем структуру
    const validatedMap: SemanticMap = {
      mergedTopics: Array.isArray(semanticData.mergedTopics) ? semanticData.mergedTopics : [],
      commonPatterns: Array.isArray(semanticData.commonPatterns) ? semanticData.commonPatterns : [],
      conflicts: Array.isArray(semanticData.conflicts) ? semanticData.conflicts : [],
      paradoxes: Array.isArray(semanticData.paradoxes) ? semanticData.paradoxes : [],
      emotionalSpikes: Array.isArray(semanticData.emotionalSpikes) ? semanticData.emotionalSpikes : [],
      visualMotifs: Array.isArray(semanticData.visualMotifs) ? semanticData.visualMotifs : [],
      audienceInterests: Array.isArray(semanticData.audienceInterests) ? semanticData.audienceInterests : [],
      rawSummary: typeof semanticData.rawSummary === 'string' ? semanticData.rawSummary : '',
    };

    console.log(`[SemanticMap] Семантическая карта успешно создана через GPT`);
    console.log(`[SemanticMap] Темы: ${validatedMap.mergedTopics.length}, Паттерны: ${validatedMap.commonPatterns.length}, Конфликты: ${validatedMap.conflicts.length}`);

    return validatedMap;

  } catch (error) {
    console.error("[SemanticMap] Ошибка GPT-вызова:", error);

    // Fallback: возвращаем базовую структуру при ошибке GPT
    console.log("[SemanticMap] Используем fallback-логику...");
    return generateSemanticMapFallback(videos);
  }
}

/**
 * Fallback-функция для генерации SemanticMap без GPT
 * Используется при ошибках OpenAI API
 */
function generateSemanticMapFallback(videos: VideoForScript[]): SemanticMap {
  // Извлекаем темы из названий видео
  const wordFrequency = new Map<string, number>();
  videos.forEach(v => {
    const words = v.title.toLowerCase()
      .replace(/[^\w\sа-яё]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
  });

  const topWords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  const allTags = videos
    .flatMap(v => v.tags || [])
    .filter((tag, i, arr) => arr.indexOf(tag) === i)
    .slice(0, 10);

  const highMomentum = videos.filter(v => v.momentumScore > 0.5);
  const audienceInterests = highMomentum.map(v => v.title).slice(0, 5);

  const avgViews = videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length;
  const channels = [...new Set(videos.map(v => v.channelTitle))].join(', ');

  return {
    mergedTopics: topWords,
    commonPatterns: allTags.length > 0 ? allTags : topWords.slice(0, 5),
    conflicts: ["Старый подход vs новый подход"],
    paradoxes: ["То, что кажется сложным, на самом деле просто"],
    emotionalSpikes: ["Страх упустить возможность", "Желание быстрого результата"],
    visualMotifs: ["Трансформация до/после", "Момент успеха"],
    audienceInterests,
    rawSummary: `Анализ ${videos.length} видео. Средние просмотры: ${Math.round(avgViews).toLocaleString()}. Каналы: ${channels}. Используется fallback-анализ.`,
  };
}

// ============================================================================
// ШАГ 3: ГЕНЕРАЦИЯ НАРРАТИВНОГО СКЕЛЕТА (GPT-ЭТАП 2)
// ============================================================================

/**
 * Системный промпт для генерации NarrativeSkeleton
 */
const NARRATIVE_SKELETON_SYSTEM_PROMPT = `Ты — профессиональный сценарист и storytelling-архитектор YouTube уровня Netflix, DW Documentary, Kurzgesagt.
Тебе передают Semantic Map с глубинным анализом тем, конфликтов, парадоксов и эмоциональных триггеров.

Твоя задача — построить каркас будущего сценария: narrative skeleton.

НАСТОЯТЕЛЬНО ВАЖНО:
- НЕ писать сам сценарий.
- Генерировать ТОЛЬКО структуру.
- Вернуть ТОЛЬКО валидный JSON.
- Никаких комментариев, markdown или пояснений.
- Пиши строго на русском языке.

Ты работаешь как narrative-engineer, а не как сценарист текста.`;

/**
 * Генерирует нарративный скелет на основе семантической карты через OpenAI GPT
 * Это GPT-ЭТАП 2 pipeline - построение каркаса сценария
 */
async function generateNarrativeSkeleton(
  map: SemanticMap,
  videos: VideoForScript[]
): Promise<NarrativeSkeleton> {
  console.log(`[NarrativeSkeleton] Начинаем GPT-генерацию каркаса...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Подготавливаем данные SemanticMap для GPT
  const semanticMapData = {
    mergedTopics: map.mergedTopics,
    commonPatterns: map.commonPatterns,
    conflicts: map.conflicts,
    paradoxes: map.paradoxes,
    emotionalSpikes: map.emotionalSpikes,
    visualMotifs: map.visualMotifs,
    audienceInterests: map.audienceInterests,
    rawSummary: map.rawSummary,
  };

  // Данные видео для контекста (id/title/momentumScore/viewsPerDay)
  const selectedVideosData = videos
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 6)
    .map(v => ({
      id: v.id,
      title: v.title,
      momentumScore: v.momentumScore,
      viewsPerDay: v.viewsPerDay,
    }));

  // Формируем user prompt
  const userPrompt = `Сформируй Narrative Skeleton на основе semanticMap и ключевой информации о видео.

SEMANTIC MAP:
${JSON.stringify(semanticMapData, null, 2)}

SELECTED VIDEOS (топ по momentum):
${JSON.stringify(selectedVideosData, null, 2)}

Сконструируй:
- coreIdea (1 предложение) — центральная идея будущего видео, главный посыл
- centralParadox (1-2 предложения) — главный парадокс, противоречие или "mind-twist", который заставит зрителя сказать "Как так?!"
- mainConflict (1-2 предложения) — главный конфликт идей, интересов, фактов
- mainQuestion (1 вопрос) — главный вопрос, который удерживает внимание зрителя до конца
- emotionalBeats (4-7 пунктов) — ключевые эмоциональные точки (страх, удивление, злость, надежда, шок, кульминация)
- storyBeats (5-10 пунктов) — крупные блоки будущего сюжета, структура повествования от хука до концовки
- visualMotifs (3-6 образов) — визуальные образы, сцены, метафоры для усиления воздействия
- hookCandidates (3-6 идей) — варианты мощных hook'ов для первых 3-5 секунд (конкретные фразы или действия)
- endingIdeas (2-4 варианта) — варианты концовки/вывода, которые побудят зрителя подписаться/лайкнуть/прокомментировать

Верни строго JSON вида NarrativeSkeleton:
{
  "coreIdea": "...",
  "centralParadox": "...",
  "mainConflict": "...",
  "mainQuestion": "...",
  "emotionalBeats": ["...", "...", ...],
  "storyBeats": ["...", "...", ...],
  "visualMotifs": ["...", "...", ...],
  "hookCandidates": ["...", "...", ...],
  "endingIdeas": ["...", "...", ...]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: NARRATIVE_SKELETON_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    });

    // Логгирование GPT-ответа
    console.log("[GPT skeleton] finish_reason:", completion.choices[0]?.finish_reason);
    console.log("[GPT skeleton] usage:", completion.usage);

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("Пустой ответ от OpenAI при генерации NarrativeSkeleton");
    }

    console.log(`[NarrativeSkeleton] Получен ответ от OpenAI (${responseText.length} символов)`);

    // Парсим JSON с очисткой от возможных markdown-обёрток
    let skeletonData: NarrativeSkeleton;
    try {
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      skeletonData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("[NarrativeSkeleton] Ошибка парсинга JSON:", parseError);
      console.error("[NarrativeSkeleton] Raw response:", responseText);
      throw new Error("Ошибка парсинга NarrativeSkeleton от OpenAI");
    }

    // Валидируем и нормализуем структуру
    const validatedSkeleton: NarrativeSkeleton = {
      coreIdea: typeof skeletonData.coreIdea === 'string' ? skeletonData.coreIdea : '',
      centralParadox: typeof skeletonData.centralParadox === 'string' ? skeletonData.centralParadox : '',
      mainConflict: typeof skeletonData.mainConflict === 'string' ? skeletonData.mainConflict : '',
      mainQuestion: typeof skeletonData.mainQuestion === 'string' ? skeletonData.mainQuestion : '',
      emotionalBeats: Array.isArray(skeletonData.emotionalBeats) ? skeletonData.emotionalBeats : [],
      storyBeats: Array.isArray(skeletonData.storyBeats) ? skeletonData.storyBeats : [],
      visualMotifs: Array.isArray(skeletonData.visualMotifs) ? skeletonData.visualMotifs : map.visualMotifs,
      hookCandidates: Array.isArray(skeletonData.hookCandidates) ? skeletonData.hookCandidates : [],
      endingIdeas: Array.isArray(skeletonData.endingIdeas) ? skeletonData.endingIdeas : [],
    };

    console.log(`[NarrativeSkeleton] Каркас успешно создан через GPT`);
    console.log(`[NarrativeSkeleton] StoryBeats: ${validatedSkeleton.storyBeats.length}, Hooks: ${validatedSkeleton.hookCandidates.length}`);

    return validatedSkeleton;

  } catch (error) {
    console.error("[NarrativeSkeleton] Ошибка GPT-вызова:", error);

    // Fallback: возвращаем базовую структуру при ошибке GPT
    console.log("[NarrativeSkeleton] Используем fallback-логику...");
    return generateNarrativeSkeletonFallback(map, videos);
  }
}

/**
 * Fallback-функция для генерации NarrativeSkeleton без GPT
 * Используется при ошибках OpenAI API
 */
function generateNarrativeSkeletonFallback(
  map: SemanticMap,
  videos: VideoForScript[]
): NarrativeSkeleton {
  const mainTopic = map.mergedTopics[0] || "интересная тема";
  const secondTopic = map.mergedTopics[1] || "";

  const coreIdea = `Видео о ${mainTopic}` +
    (secondTopic ? ` с фокусом на ${secondTopic}` : "");

  const centralParadox = map.paradoxes[0] ||
    `Почему ${mainTopic} работает не так, как все думают`;

  const mainConflict = map.conflicts[0] ||
    `Старый подход vs новый подход к ${mainTopic}`;

  const mainQuestion = `Как использовать ${mainTopic} для достижения результата?`;

  const emotionalBeats = [
    "Интрига в начале - неожиданный факт",
    "Нарастание напряжения - проблема",
    "Кульминация - решение",
    "Завершение - призыв к действию",
  ];

  const storyBeats = [
    "Хук: привлечь внимание за 3 секунды",
    "Проблема: показать боль аудитории",
    "Обещание: что зритель получит",
    "Основной контент: раскрытие темы",
    "Доказательства: примеры и факты",
    "Призыв к действию: что делать дальше",
  ];

  const topVideos = videos
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 3);

  const hookCandidates = topVideos.length > 0
    ? topVideos.map(v => `Адаптация: "${v.title.slice(0, 40)}..."`)
    : [`Шокирующий факт о ${mainTopic}`, `Вопрос: Вы знали, что ${mainTopic}...?`];

  const endingIdeas = [
    "Резюме ключевых выводов + призыв подписаться",
    "Открытый вопрос для комментариев",
    "Тизер следующего видео",
  ];

  return {
    coreIdea,
    centralParadox,
    mainConflict,
    mainQuestion,
    emotionalBeats,
    storyBeats,
    visualMotifs: map.visualMotifs,
    hookCandidates,
    endingIdeas,
  };
}

// ============================================================================
// ШАГ 4: ГЕНЕРАЦИЯ СЦЕНАРИЯ ЧЕРЕЗ OPENAI
// ============================================================================

/**
 * Системный промпт для генерации финального сценария (V2 - Elite Documentary Style)
 */
const SCRIPT_GENERATOR_SYSTEM_PROMPT_V2 = `Ты — элитный сценарист, документалист и нарративный дизайнер уровня Netflix, Vox, DW Documentary и Kurzgesagt.

Твоя задача — создать ОДИН финальный сценарий на основе:
- Narrative Skeleton (структурный каркас)
- Semantic Map (глубокий смысловой анализ)
- Данных выбранных видео (темы, динамика, метрики)
- Инструкций ниже

Это КУЛЬМИНАЦИЯ всего pipeline: создаёшь произведение высшего уровня.

-------------------------------------
СТИЛЬ (ОБЯЗАТЕЛЬНО):
-------------------------------------
1) Документальный, кинематографичный, интеллектуальный
2) Богатый визуальными метафорами
3) Сильная драматургия (как будто монтаж уже в голове)
4) Научный, но эмоционально понятный
5) XXI век: динамичный, современный, цепляющий

-------------------------------------
ОБЩИЕ ПРАВИЛА:
-------------------------------------
1) Пиши только на русском языке.
2) Не делай "пересказ" выбранных видео — создавай новый уникальный сюжет.
3) Используй skeleton строго:
   - coreIdea — центральная концепция
   - centralParadox — драматическое продвижение конфликта
   - mainConflict — эмоциональная ось
   - mainQuestion — удерживающий элемент
   - storyBeats — основа структуры
   - emotionalBeats — точки эмоционального напряжения
   - visualMotifs — визуальная атмосфера
   - hookCandidates — источник для мощного хука
   - endingIdeas — варианты сильных финалов
4) Не нарушай структуру финального JSON.

-------------------------------------
ТРЕБОВАНИЯ К ОТДЕЛЬНЫМ ЧАСТЯМ:
-------------------------------------

### 1) title
Создай короткое, цепляющее, интригующее название.
Используй парадокс, конфликт или главный вопрос.
Название должно "хотеться открыть".

### 2) hook
Сформируй 1–2 предложения, которые:
- шокируют,
- обещают раскрытие тайны,
- задают конфликт,
- содержат парадокс или драматическую интригу.

Хук должен быть мощным, как трейлер.

### 3) outline
Построй структурный план (5–12 пунктов), который:
- следует storyBeats,
- усиливает драматургию,
- показывает развитие идеи,
- не просто "пункты", а маленькие смысловые заголовки.

### 4) scriptText
Это главная часть.
Она должна быть:
- связной
- глубокой
- насыщенной
- художественной
- визуальной
- эмоциональной
- научно точной

Принципы:
- Каждая часть должна развивать драматургию.
- Используй парадоксы, метафоры, визуальные сцены.
- Используй emotionalBeats и visualMotifs.
- Встраивай объяснения так, чтобы они выглядели как "обзор будущего фильма".
- Весь сценарий — как voice-over документального фильма в высоком продакшене.
- Текст должен быть ДЛИННЫМ и ПОЛНЫМ (модель может писать сколько нужно).

### 5) whyItShouldWork
Объясни:
- Почему сценарий выстрелит.
- На каких паттернах успеха (commonPatterns) он основан.
- Какие темы аудитория любит (audienceInterests).
- Какие эмоции задействованы (emotionalSpikes).
- Почему структура удерживает внимание.
- Как визуальные мотивы работают на "эффект Netflix".

-------------------------------------
ФИНАЛЬНЫЙ ФОРМАТ (СТРОГО!):
-------------------------------------
{
  "script": {
    "title": "...",
    "hook": "...",
    "outline": ["...", "..."],
    "scriptText": "...",
    "whyItShouldWork": "..."
  }
}

Без markdown и лишнего текста.
Без бэкслешей.
Только валидный JSON.`;

/**
 * Генерирует финальный сценарий через OpenAI
 * Использует скелет и данные видео для создания готового текста
 * @param temperature - температура для GPT-вызова (влияет на креативность)
 */
async function generateScriptFromSkeleton(
  skeleton: NarrativeSkeleton,
  videos: VideoForScript[],
  semanticMap: SemanticMap,
  temperature: number
): Promise<GeneratedScript> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Подготавливаем данные для промпта
  const videosContext = videos.map(v => ({
    title: v.title,
    channel: v.channelTitle,
    views: v.viewCount,
    viewsPerDay: v.viewsPerDay,
    momentum: v.momentumScore,
  }));

  // Формируем полный Narrative Skeleton как JSON для промпта
  const skeletonData = {
    coreIdea: skeleton.coreIdea,
    centralParadox: skeleton.centralParadox,
    mainConflict: skeleton.mainConflict,
    mainQuestion: skeleton.mainQuestion,
    emotionalBeats: skeleton.emotionalBeats,
    storyBeats: skeleton.storyBeats,
    visualMotifs: skeleton.visualMotifs,
    hookCandidates: skeleton.hookCandidates,
    endingIdeas: skeleton.endingIdeas,
  };

  const prompt = `Ты — эксперт по созданию виральных YouTube сценариев.
Твоя задача — создать финальный сценарий на основе подготовленного Narrative Skeleton и анализа успешных видео конкурентов.

КОНТЕКСТ АНАЛИЗА:
${semanticMap.rawSummary}

NARRATIVE SKELETON (каркас сценария):
${JSON.stringify(skeletonData, null, 2)}

УСПЕШНЫЕ ВИДЕО ДЛЯ ВДОХНОВЛЕНИЯ:
${JSON.stringify(videosContext, null, 2)}

ТЕМЫ И ПАТТЕРНЫ:
- Темы: ${semanticMap.mergedTopics.join(', ')}
- Интересы аудитории: ${semanticMap.audienceInterests.join(', ')}

ИНСТРУКЦИИ:
1. Используй coreIdea как основу главного посыла видео
2. Выбери лучший hook из hookCandidates или создай свой на их основе
3. Следуй структуре storyBeats при написании scriptText
4. Включи emotionalBeats в нужные моменты сценария
5. Используй visualMotifs для описания визуального ряда
6. Выбери концовку из endingIdeas или создай свою на их основе
7. Сделай название на основе centralParadox или mainQuestion

ЗАДАЧА:
Создай сценарий YouTube видео, который:
1. Имеет цепляющий хук (первые 3-5 секунд)
2. Удерживает внимание на протяжении всего видео
3. Использует паттерны успешных видео конкурентов
4. Имеет чёткую структуру и призыв к действию

ВАЖНО: Отвечай СТРОГО на русском языке.

Верни ответ в формате JSON:
{
  "title": "Название видео (цепляющее, до 60 символов)",
  "hook": "Хук для первых 3-5 секунд видео",
  "outline": ["Пункт 1 плана", "Пункт 2 плана", "Пункт 3 плана", ...],
  "scriptText": "Полный текст сценария с разбивкой на секции...",
  "whyItShouldWork": "Почему этот сценарий должен сработать (на основе анализа)"
}`;

  console.log(`[ScriptGenerate] Отправляем запрос в OpenAI (temperature: ${temperature})...`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: SCRIPT_GENERATOR_SYSTEM_PROMPT_V2,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature,
  });

  // Логгирование GPT-ответа
  console.log("[GPT script] finish_reason:", completion.choices[0]?.finish_reason);
  console.log("[GPT script] usage:", completion.usage);

  const responseText = completion.choices[0]?.message?.content;

  if (!responseText) {
    throw new Error("Нет ответа от OpenAI");
  }

  console.log(`[ScriptGenerate] Получен ответ от OpenAI`);

  // Парсим JSON ответ
  let scriptData: GeneratedScript;
  try {
    // Убираем возможные markdown-обёртки
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    scriptData = JSON.parse(cleanJson);
  } catch (parseError) {
    console.error("[ScriptGenerate] Ошибка парсинга JSON:", parseError);
    console.error("[ScriptGenerate] Raw response:", responseText);
    throw new Error("Ошибка парсинга ответа от OpenAI");
  }

  // Валидируем обязательные поля
  if (!scriptData.title || !scriptData.hook || !scriptData.outline || !scriptData.scriptText) {
    throw new Error("Неполный ответ от OpenAI: отсутствуют обязательные поля");
  }

  return {
    title: scriptData.title,
    hook: scriptData.hook,
    outline: Array.isArray(scriptData.outline) ? scriptData.outline : [],
    scriptText: scriptData.scriptText,
    whyItShouldWork: scriptData.whyItShouldWork || "Сценарий основан на анализе успешных видео конкурентов",
  };
}

// ============================================================================
// ОСНОВНОЙ HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Аутентификация
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log("[GENERATOR] userId =", userId, "type:", typeof userId);

    // 2. Парсим тело запроса
    const body = await req.json();
    const { sourceMode = "trending", selectedVideoIds, youtubeUrl, temperature } = body as {
      sourceMode?: "trending" | "youtube";
      selectedVideoIds?: string[];
      youtubeUrl?: string;
      temperature?: number;
    };

    // Валидация контракта
    let videos: VideoForScript[] = [];

    if (sourceMode === "youtube") {
      // YouTube режим
      if (!youtubeUrl || typeof youtubeUrl !== "string" || youtubeUrl.trim().length === 0) {
        return NextResponse.json(
          { error: "youtubeUrl is required for youtube sourceMode" },
          { status: 400 }
        );
      }

      const videoId = parseYoutubeVideoId(youtubeUrl);
      if (!videoId) {
        return NextResponse.json(
          { error: "Invalid YouTube URL" },
          { status: 400 }
        );
      }

      console.log(`[ScriptGenerate] YouTube режим. VideoId: ${videoId}`);

      // Попытаемся найти видео в БД
      let dbVideo = await db.execute({
        sql: `SELECT videoId, title, channelId, viewCountInt, likeCountInt, commentCountInt, publishDate FROM channel_videos WHERE videoId = ?`,
        args: [videoId],
      });

      if (dbVideo.rows.length === 0) {
        // Видео не в БД — получаем из API и сохраняем
        const rawVideoData = await fetchYouTubeVideoData(youtubeUrl, videoId);
        if (!rawVideoData) {
          return NextResponse.json(
            { error: "Failed to fetch video data from YouTube" },
            { status: 502 }
          );
        }

        // Сохраняем видео в channel_videos (UPSERT)
        await db.execute({
          sql: `
            INSERT INTO channel_videos
            (videoId, title, channelId, viewCountInt, likeCountInt, commentCountInt, publishDate, fetchedAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(videoId) DO UPDATE SET
              title = excluded.title,
              channelId = excluded.channelId,
              viewCountInt = excluded.viewCountInt,
              likeCountInt = excluded.likeCountInt,
              commentCountInt = excluded.commentCountInt,
              publishDate = excluded.publishDate,
              updatedAt = excluded.updatedAt
          `,
          args: [
            rawVideoData.id,
            rawVideoData.title,
            rawVideoData.channelId || null,
            rawVideoData.viewCountInt,
            rawVideoData.likeCountInt || null,
            rawVideoData.commentCountInt || null,
            rawVideoData.publishDate,
            Math.floor(Date.now() / 1000),
            Math.floor(Date.now() / 1000),
          ],
        });

        console.log(`[ScriptGenerate] Видео сохранено в БД из API`);
      }

      // Читаем видео из БД (источник правды)
      const dbVideoRefresh = await db.execute({
        sql: `SELECT videoId, title, channelId, viewCountInt, likeCountInt, commentCountInt, publishDate FROM channel_videos WHERE videoId = ?`,
        args: [videoId],
      });

      if (dbVideoRefresh.rows.length === 0) {
        return NextResponse.json(
          { error: "Failed to store video in database" },
          { status: 500 }
        );
      }

      const row = dbVideoRefresh.rows[0];
      const viewCount = Number(row.viewCountInt) || 0;
      const publishDate = row.publishDate as string;
      const days = daysSincePublish(publishDate);
      const viewsPerDay = viewCount / days;

      // Получаем информацию о канале
      const channelResult = await db.execute({
        sql: `SELECT title, handle FROM competitors WHERE channelId = ?`,
        args: [row.channelId],
      });

      const channelInfo = channelResult.rows[0];

      videos = [
        {
          id: videoId,
          title: row.title as string,
          channelTitle: channelInfo?.title || "Unknown Channel",
          channelHandle: channelInfo?.handle as string | undefined,
          viewCount,
          likeCount: row.likeCountInt ? Number(row.likeCountInt) : undefined,
          commentCount: row.commentCountInt ? Number(row.commentCountInt) : undefined,
          viewsPerDay: Math.round(viewsPerDay),
          momentumScore: 0,
          publishDate,
        },
      ];
      console.log(`[ScriptGenerate] Видео прочитано из БД (YouTube режим)`);
    } else {
      // Trending режим (по умолчанию)
      if (!selectedVideoIds || !Array.isArray(selectedVideoIds) || selectedVideoIds.length === 0) {
        return NextResponse.json(
          { error: "selectedVideoIds is required and must be a non-empty array for trending sourceMode" },
          { status: 400 }
        );
      }

      console.log(`[ScriptGenerate] Trending режим. Videos: ${selectedVideoIds.length}`);

      // 3. PIPELINE: Сбор данных по видео (существующая логика)
      videos = await collectVideoData(selectedVideoIds, userId);
    }

    // Нормализация температуры для финального GPT-вызова
    let scriptTemperature = 0.8; // дефолт на бэкенде
    if (typeof temperature === "number" && Number.isFinite(temperature)) {
      // Ограничиваем диапазон для безопасности
      const min = 0.3;
      const max = 1.3;
      scriptTemperature = Math.min(max, Math.max(min, temperature));
    }

    console.log(`[ScriptGenerate] Начало генерации. User: ${userId}, Videos: ${videos.length}, Temperature: ${scriptTemperature}`);

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "Видео не найдены. Убедитесь, что видео синхронизированы." },
        { status: 404 }
      );
    }

    // 4. PIPELINE: Генерация семантической карты
    const semanticMap = await generateSemanticMap(videos);

    // 5. PIPELINE: Генерация нарративного скелета
    const narrativeSkeleton = await generateNarrativeSkeleton(semanticMap, videos);

    // 6. PIPELINE: Генерация финального сценария через OpenAI
    const generatedScript = await generateScriptFromSkeleton(
      narrativeSkeleton,
      videos,
      semanticMap,
      scriptTemperature
    );

    // 7. Сохранение в БД
    const scriptId = randomUUID();
    const createdAt = Date.now();
    const sourceVideoIds = videos.map(v => v.id);

    await db.execute({
      sql: `
        INSERT INTO generated_scripts
        (id, userId, title, hook, outline, scriptText, whyItShouldWork, sourceVideos, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        scriptId,
        userId,
        generatedScript.title,
        generatedScript.hook,
        JSON.stringify(generatedScript.outline),
        generatedScript.scriptText,
        generatedScript.whyItShouldWork,
        JSON.stringify(sourceVideoIds),
        createdAt,
      ],
    });

    console.log(`[ScriptGenerate] Сценарий сохранён в БД: ${scriptId}`);

    // 7.1. Инкремент использования сценариев
    const today = new Date().toISOString().split('T')[0];
    const updatedAtTs = Math.floor(Date.now() / 1000);
    console.log("[GENERATOR] UPSERT user_usage_daily: userId =", userId, "day =", today, "scriptsUsed += 1");

    await db.execute({
      sql: `
        INSERT INTO user_usage_daily (userId, day, scriptsUsed, updatedAt)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(userId, day)
        DO UPDATE SET
          scriptsUsed = scriptsUsed + 1,
          updatedAt = excluded.updatedAt
      `,
      args: [userId, today, updatedAtTs],
    });

    console.log(`[ScriptGenerate] Использование сценариев обновлено для ${userId} на ${today}`);

    // Лог-проверка: убедиться, что запись реально в БД
    const checkUsage = await db.execute({
      sql: `SELECT scriptsUsed FROM user_usage_daily WHERE userId = ? AND day = ?`,
      args: [userId, today],
    });
    const usageRecord = checkUsage.rows?.[0];
    console.log(`[ScriptGenerate] ПРОВЕРКА БД: userId=${userId}, day=${today}, scriptsUsed=${usageRecord?.scriptsUsed || 'N/A'}`);

    // 8. Формируем ответ
    const savedScript: SavedScript = {
      id: scriptId,
      userId,
      title: generatedScript.title,
      hook: generatedScript.hook,
      outline: generatedScript.outline,
      scriptText: generatedScript.scriptText,
      whyItShouldWork: generatedScript.whyItShouldWork,
      sourceVideos: sourceVideoIds,
      createdAt,
    };

    return NextResponse.json({ script: savedScript }, { status: 201 });

  } catch (error) {
    console.error("[ScriptGenerate] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Ошибка генерации сценария" },
      { status: 500 }
    );
  }
}
