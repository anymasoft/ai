import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";
import type { GeneratedScript, SavedScript } from "@/types/scripts";

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
  publishedAt: string;
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
function daysSincePublish(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - publishDate.getTime();
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
        videoId, channelId, title, viewCount, likeCount, commentCount, publishedAt, data
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
    const viewCount = Number(row.viewCount) || 0;
    const publishedAt = row.publishedAt as string;
    const days = daysSincePublish(publishedAt);
    const viewsPerDay = viewCount / days;

    return {
      videoId: row.videoId as string,
      channelId: row.channelId as string,
      title: row.title as string,
      viewCount,
      likeCount: row.likeCount ? Number(row.likeCount) : undefined,
      commentCount: row.commentCount ? Number(row.commentCount) : undefined,
      publishedAt,
      viewsPerDay,
      data: row.data as string | null,
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

    // Пытаемся извлечь теги из data (если есть)
    let tags: string[] | undefined;
    if (video.data) {
      try {
        const parsed = JSON.parse(video.data);
        if (Array.isArray(parsed.keywords)) {
          tags = parsed.keywords;
        }
      } catch {
        // Игнорируем ошибки парсинга
      }
    }

    return {
      id: video.videoId,
      title: video.title,
      channelTitle: channelInfo?.title || "Unknown Channel",
      channelHandle: channelInfo?.handle,
      tags,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      viewsPerDay: Math.round(video.viewsPerDay),
      momentumScore: Math.round(momentumScore * 100) / 100,
      publishedAt: video.publishedAt,
    };
  });

  console.log(`[ScriptGenerate] Собрано ${videos.length} видео для анализа`);
  return videos;
}

// ============================================================================
// ШАГ 2: ГЕНЕРАЦИЯ СЕМАНТИЧЕСКОЙ КАРТЫ
// ============================================================================

/**
 * Генерирует семантическую карту на основе данных видео
 * Пока простая версия - извлекает темы и паттерны из названий
 * В будущем можно добавить вызов OpenAI для более глубокого анализа
 */
async function generateSemanticMap(videos: VideoForScript[]): Promise<SemanticMap> {
  // Извлекаем темы из названий видео
  const allTitles = videos.map(v => v.title);

  // Простой анализ: собираем ключевые слова из названий
  const wordFrequency = new Map<string, number>();
  allTitles.forEach(title => {
    // Разбиваем на слова, убираем короткие и стоп-слова
    const words = title.toLowerCase()
      .replace(/[^\w\sа-яё]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
  });

  // Топ слова как темы
  const topWords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // Собираем теги со всех видео
  const allTags = videos
    .flatMap(v => v.tags || [])
    .filter((tag, i, arr) => arr.indexOf(tag) === i)
    .slice(0, 10);

  // Определяем видео с высоким momentum
  const highMomentum = videos.filter(v => v.momentumScore > 0.5);
  const audienceInterests = highMomentum.map(v => v.title).slice(0, 5);

  // Формируем сводку
  const avgViews = videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length;
  const avgMomentum = videos.reduce((sum, v) => sum + v.momentumScore, 0) / videos.length;

  const rawSummary = `Анализ ${videos.length} видео. ` +
    `Средние просмотры: ${Math.round(avgViews).toLocaleString()}. ` +
    `Средний momentum: ${avgMomentum.toFixed(2)}. ` +
    `Топ темы: ${topWords.slice(0, 5).join(', ')}. ` +
    `Каналы: ${[...new Set(videos.map(v => v.channelTitle))].join(', ')}.`;

  console.log(`[ScriptGenerate] Семантическая карта создана`);

  return {
    mergedTopics: topWords,
    commonPatterns: allTags.length > 0 ? allTags : topWords.slice(0, 5),
    conflicts: [],           // Будет заполнено в будущих версиях через GPT
    paradoxes: [],           // Будет заполнено в будущих версиях через GPT
    emotionalSpikes: [],     // Будет заполнено в будущих версиях через GPT
    visualMotifs: [],        // Будет заполнено в будущих версиях через GPT
    audienceInterests,
    rawSummary,
  };
}

// ============================================================================
// ШАГ 3: ГЕНЕРАЦИЯ НАРРАТИВНОГО СКЕЛЕТА
// ============================================================================

/**
 * Генерирует нарративный скелет на основе семантической карты
 * Пока простая версия - формирует базовый каркас
 * В будущем можно добавить вызов OpenAI для более креативного каркаса
 */
async function generateNarrativeSkeleton(
  map: SemanticMap,
  videos: VideoForScript[]
): Promise<NarrativeSkeleton> {
  // Берём топ-тему как основу
  const mainTopic = map.mergedTopics[0] || "интересная тема";
  const secondTopic = map.mergedTopics[1] || "";

  // Формируем базовый каркас
  const coreIdea = `Видео о ${mainTopic}` +
    (secondTopic ? ` с фокусом на ${secondTopic}` : "");

  const centralParadox = map.paradoxes[0] ||
    `Почему ${mainTopic} работает не так, как все думают`;

  const mainConflict = map.conflicts[0] ||
    `Старый подход vs новый подход к ${mainTopic}`;

  const mainQuestion = `Как использовать ${mainTopic} для достижения результата?`;

  // Базовые эмоциональные точки
  const emotionalBeats = [
    "Интрига в начале - неожиданный факт",
    "Нарастание напряжения - проблема",
    "Кульминация - решение",
    "Завершение - призыв к действию",
  ];

  // Структура истории
  const storyBeats = [
    "Хук: привлечь внимание за 3 секунды",
    "Проблема: показать боль аудитории",
    "Обещание: что зритель получит",
    "Основной контент: раскрытие темы",
    "Доказательства: примеры и факты",
    "Призыв к действию: что делать дальше",
  ];

  // Варианты хуков на основе топ-видео
  const topVideos = videos
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 3);

  const hookCandidates = topVideos.map(v =>
    `Адаптация хука из "${v.title.slice(0, 50)}..."`
  );

  if (hookCandidates.length === 0) {
    hookCandidates.push(`Шокирующий факт о ${mainTopic}`);
    hookCandidates.push(`Вопрос: Вы знали, что ${mainTopic}...?`);
  }

  // Варианты концовок
  const endingIdeas = [
    "Резюме ключевых выводов + призыв подписаться",
    "Открытый вопрос для комментариев",
    "Тизер следующего видео",
  ];

  console.log(`[ScriptGenerate] Нарративный скелет создан`);

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
 * Генерирует финальный сценарий через OpenAI
 * Использует скелет и данные видео для создания готового текста
 */
async function generateScriptFromSkeleton(
  skeleton: NarrativeSkeleton,
  videos: VideoForScript[],
  semanticMap: SemanticMap
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

  const prompt = `Ты — эксперт по созданию виральных YouTube сценариев.
Твоя задача — создать сценарий на основе анализа успешных видео конкурентов.

КОНТЕКСТ АНАЛИЗА:
${semanticMap.rawSummary}

НАРРАТИВНЫЙ КАРКАС:
- Главная идея: ${skeleton.coreIdea}
- Центральный парадокс: ${skeleton.centralParadox}
- Главный конфликт: ${skeleton.mainConflict}
- Главный вопрос: ${skeleton.mainQuestion}
- Варианты хуков: ${skeleton.hookCandidates.join('; ')}
- Структура: ${skeleton.storyBeats.join(' -> ')}

УСПЕШНЫЕ ВИДЕО ДЛЯ ВДОХНОВЕНИЯ:
${JSON.stringify(videosContext, null, 2)}

ТЕМЫ И ПАТТЕРНЫ:
- Темы: ${semanticMap.mergedTopics.join(', ')}
- Интересы аудитории: ${semanticMap.audienceInterests.join(', ')}

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

  console.log(`[ScriptGenerate] Отправляем запрос в OpenAI...`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Ты — эксперт по созданию виральных YouTube сценариев. Всегда отвечай на русском языке. Возвращай только валидный JSON без markdown."
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.8,
    max_tokens: 3000,
  });

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

    // 2. Парсим тело запроса
    const body = await req.json();
    const { selectedVideoIds } = body as { selectedVideoIds: string[] };

    if (!selectedVideoIds || !Array.isArray(selectedVideoIds) || selectedVideoIds.length === 0) {
      return NextResponse.json(
        { error: "selectedVideoIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    console.log(`[ScriptGenerate] Запрос на генерацию сценария. User: ${userId}, Videos: ${selectedVideoIds.length}`);

    // 3. PIPELINE: Сбор данных по видео
    const videos = await collectVideoData(selectedVideoIds, userId);

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
      semanticMap
    );

    // 7. Сохранение в БД
    const scriptId = crypto.randomUUID();
    const createdAt = Date.now();

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
        JSON.stringify(selectedVideoIds),
        createdAt,
      ],
    });

    console.log(`[ScriptGenerate] Сценарий сохранён в БД: ${scriptId}`);

    // 8. Формируем ответ
    const savedScript: SavedScript = {
      id: scriptId,
      userId,
      title: generatedScript.title,
      hook: generatedScript.hook,
      outline: generatedScript.outline,
      scriptText: generatedScript.scriptText,
      whyItShouldWork: generatedScript.whyItShouldWork,
      sourceVideos: selectedVideoIds,
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
