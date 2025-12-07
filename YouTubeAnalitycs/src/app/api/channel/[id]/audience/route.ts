import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

interface VideoWithEngagement {
  id: number;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  durationSeconds: number | null;
  isShort: boolean;
  engagementScore: number;
  likeRate: number;
  commentRate: number;
  viewsPerDay: number;
  momentumScore: number;
  titleScore: number;
  category: "High Engagement" | "Rising" | "Normal" | "Weak";
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
function daysSincePublish(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const diffMs = new Date().getTime() - publishDate.getTime();
  return Math.max(diffMs / (1000 * 60 * 60 * 24), 1);
}

/**
 * Вычисляет title_score на основе ключевых слов
 */
function calculateTitleScore(title: string): number {
  const keywords = [
    'tutorial', 'guide', 'how to', 'review', 'vs', 'comparison',
    'story', 'experience', 'rant', 'opinion', 'thoughts', 'reaction',
    'explained', 'tips', 'tricks', 'secrets', 'best', 'worst'
  ];

  const lowerTitle = title.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lowerTitle.includes(keyword)) {
      score += 0.15;
    }
  }

  return Math.min(score, 1.0); // Максимум 1.0
}

/**
 * POST /api/channel/[id]/audience
 * Генерирует audience engagement анализ для видео канала
 *
 * PROD CHECKLIST:
 * [ ] Раскомментировать кэширование (строка 293-310, 3 дня кэша)
 * [ ] Проверить max_tokens - должен быть удален (модель остановится сама)
 * [ ] Убедиться что используется только gpt-4.1-mini
 * [ ] Проверить temperature (текущее: 0.6, для конкретики)
 * [ ] Валидировать JSON парсинг из OpenAI (строка 451)
 * [ ] Проверить обработку ошибок API (try-catch на строке 447)
 * [ ] Убедиться что видео с недостаточными данными обрабатываются корректно
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

    console.log(`[Audience] Запрос анализа для competitor ID: ${competitorId}`);

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

    console.log(`[Audience] Канал найден: ${competitor.title}`);

    // Получаем последние 150 видео канала
    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channelId = ? ORDER BY publishedAt DESC LIMIT 150",
      args: [competitor.channelId],
    });

    if (videosResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Sync Top Videos first" },
        { status: 400 }
      );
    }

    const videos = videosResult.rows.map(row => ({
      id: row.id as number,
      videoId: row.videoId as string,
      title: row.title as string,
      viewCount: row.viewCount as number,
      likeCount: row.likeCount as number,
      commentCount: row.commentCount as number,
      publishedAt: row.publishedAt as string,
      duration: row.duration as number | null,
    }));

    console.log(`[Audience] Найдено ${videos.length} видео для анализа`);

    // Обогащаем видео данными из videoDetails если доступны
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let enrichedCount = 0;

    for (const video of videos) {
      // Проверяем, есть ли детальные данные для этого видео
      const detailsResult = await client.execute({
        sql: "SELECT * FROM video_details WHERE videoId = ?",
        args: [video.videoId],
      });

      // Если детальные данные существуют и не устарели, используем их
      if (detailsResult.rows.length > 0) {
        const details = detailsResult.rows[0];
        if ((details.updatedAt as number) > sevenDaysAgo) {
          video.likeCount = details.likeCount as number;
          video.commentCount = details.commentCount as number;
          enrichedCount++;
        }
      }
    }

    console.log(`[Audience] Обогащено ${enrichedCount} видео из videoDetails`);

    // Проверяем наличие данных о лайках и комментариях
    const hasEngagementData = videos.some(v => v.likeCount > 0 || v.commentCount > 0);
    const usingFallback = !hasEngagementData;

    console.log(`[Audience] Режим анализа: ${usingFallback ? 'FALLBACK (proxy metrics)' : 'STANDARD (likes+comments)'}`);

    // Вычисляем engagement метрики для каждого видео
    const videosWithMetrics: VideoWithEngagement[] = videos.map(v => {
      const days = daysSincePublish(v.publishedAt);
      const viewsPerDay = v.viewCount / days;
      const likeRate = v.viewCount > 0 ? v.likeCount / v.viewCount : 0;
      const commentRate = v.viewCount > 0 ? v.commentCount / v.viewCount : 0;
      const titleScore = calculateTitleScore(v.title);

      // Вычисляем momentum_score (упрощенная версия без БД)
      const momentumScore = 0; // TODO: можно интегрировать с momentum_insights если нужно

      // Вычисляем durationSeconds и isShort
      const durationSeconds = v.duration ? Math.round(v.duration) : null;
      const isShort = durationSeconds ? durationSeconds < 60 : false;

      return {
        id: v.id,
        title: v.title,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
        publishedAt: v.publishedAt,
        durationSeconds,
        isShort,
        engagementScore: 0, // Будет вычислен после подсчёта медианы
        likeRate,
        commentRate,
        viewsPerDay,
        momentumScore,
        titleScore,
        category: "Normal" as const,
      };
    });

    // Вычисляем медиану viewsPerDay для нормализации
    const viewsPerDayValues = videosWithMetrics.map(v => v.viewsPerDay);
    const medianViewsPerDay = calculateMedian(viewsPerDayValues);

    // Теперь вычисляем engagement_score с нормализованным viewsPerDay
    videosWithMetrics.forEach(v => {
      // Нормализуем viewsPerDay относительно медианы (получаем коэффициент)
      const normalizedViewsPerDay = medianViewsPerDay > 0
        ? (v.viewsPerDay / medianViewsPerDay) - 1  // от -1 до +много
        : 0;

      let engagementScore: number;

      if (usingFallback) {
        // Fallback режим: используем прокси метрики
        engagementScore = (
          normalizedViewsPerDay * 0.5 +
          v.titleScore * 0.3 +
          v.momentumScore * 0.2
        );
      } else {
        // Стандартный режим: комбинируем все метрики
        // likeRate и commentRate уже нормализованы (0-1)
        // normalizedViewsPerDay теперь тоже коэффициент (-1 до +много)
        engagementScore = (
          v.likeRate * 0.5 +
          v.commentRate * 0.5 +
          normalizedViewsPerDay * 0.3 +  // Уменьшили вес с 0.4 до 0.3
          v.titleScore * 0.2 +            // Уменьшили вес с 0.3 до 0.2
          v.momentumScore * 0.1           // Уменьшили вес с 0.2 до 0.1
        );
      }

      v.engagementScore = engagementScore;
    });

    // Вычисляем медиану engagement_score
    const engagementScores = videosWithMetrics.map(v => v.engagementScore);
    const medianEngagement = calculateMedian(engagementScores);

    console.log(`[Audience] Медиана engagement_score: ${medianEngagement.toFixed(6)}`);

    // Категоризируем видео по engagement
    videosWithMetrics.forEach(v => {
      const engagementDiff = medianEngagement > 0
        ? (v.engagementScore / medianEngagement) - 1
        : 0;

      if (engagementDiff > 0.5) {
        v.category = "High Engagement";
      } else if (engagementDiff > 0.1) {
        v.category = "Rising";
      } else if (engagementDiff < -0.3) {
        v.category = "Weak";
      } else {
        v.category = "Normal";
      }
    });

    // Фильтруем High Engagement видео
    let highEngagementVideos = videosWithMetrics
      .filter(v => v.category === "High Engagement")
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 30); // Топ 30

    console.log(`[Audience] High Engagement видео: ${highEngagementVideos.length}`);

    // Fallback: если нет High Engagement видео, берём топ 30 по engagement_score
    if (highEngagementVideos.length === 0) {
      console.log(`[Audience] Fallback: берём топ 30 по engagement_score`);
      highEngagementVideos = videosWithMetrics
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 30);
    }

    // TODO [PROD]: Кэширование отключено на время разработки
    // В прод. версии РАСКОММЕНТИРОВАТЬ, чтобы не регенерировать анализ каждый раз
    // Кэш 3 дня для одного канала
    // const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    // const existingAnalysisResult = await client.execute({
    //   sql: "SELECT * FROM audience_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
    //   args: [competitor.channelId],
    // });
    // if (existingAnalysisResult.rows.length > 0) {
    //   const existingAnalysis = existingAnalysisResult.rows[0];
    //   if ((existingAnalysis.generatedAt as number) > threeDaysAgo) {
    //     console.log(`[Audience] Найден свежий анализ`);
    //     client.close();
    //     return NextResponse.json({
    //       ...JSON.parse(existingAnalysis.data as string),
    //       generatedAt: existingAnalysis.generatedAt,
    //     });
    //   }
    // }

    console.log(`[Audience] Генерируем новый анализ через OpenAI...`);

    // Подготовка данных для OpenAI
    const videosForAnalysis = highEngagementVideos.map(v => ({
      title: v.title,
      views: v.viewCount,
      publishedAt: v.publishedAt,
      durationSeconds: v.durationSeconds,
      isShort: v.isShort,
      likes: v.likeCount,
      comments: v.commentCount,
      engagementRate: `${((v.likeRate + v.commentRate) * 100).toFixed(2)}%`,
      viewsPerDay: Math.round(v.viewsPerDay),
      engagementScore: v.engagementScore.toFixed(6),
      likeRate: `${(v.likeRate * 100).toFixed(2)}%`,
      commentRate: `${(v.commentRate * 100).toFixed(2)}%`,
    }));

    // Инициализация OpenAI клиента
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // TODO [PROD]: Промпты v2.0 (проверить качество анализа перед продакшном)
    // Система должна быть эксперт, пользователь получит JSON с 8 разделами
    const systemPrompt = "Ты — эксперт по YouTube-аналитике, продуктовый стратег и специалист по поведенческой сегментации аудитории. Твоя задача — определить: 1) кто смотрит этот канал; 2) какие у них мотивы, ожидания и боли; 3) какие сегменты аудитории существуют; 4) что им нравится и что НЕ нравится; 5) как автору использовать это, чтобы резко ускорить рост. Отвечай ТОЛЬКО на русском языке. JSON ответ должен содержать разделы согласно структуре ответа. Все значения должны быть конкретными, не общими фразами.";

    const userPrompt = `Ты получишь JSON с топ-видео канала "${competitor.title}", включая title, views, publishedAt, durationSeconds, isShort, engagementRate, likes, comments.

ТВОЯ ЗАДАЧА — определить:
1) кто смотрит этот канал;
2) какие у них мотивы, ожидания и боли;
3) какие сегменты аудитории существуют;
4) что им нравится и что НЕ нравится;
5) как автору использовать это, чтобы резко ускорить рост.

---

# СТРУКТУРА ОТВЕТА (строго соблюдать):

## 1. Краткий профиль аудитории (2 абзаца)
Опиши:
- какой тип аудитории смотрит канал (интересы, уровень знаний, поведение);
- по каким признакам (форматы, темы, заголовки, длительность, пики просмотров);
- чем эта аудитория отличается от массовой.

## 2. Мотивации и потребности аудитории (5–10 пунктов)
Для каждого мотива:
- что человек хочет получить через просмотр;
- какие видео из выборки этот мотив подтверждают;
- какие ожидания у этого типа зрителей.

## 3. Сегментация аудитории (3–6 сегментов)
Каждый сегмент — мини-портрет:
- кто это (новичок/продвинутый/эксперт/фанат/охотник за сенсациями/профессионал);
- что он смотрит (примеры видео);
- почему этот контент его привлекает;
- какой формат ему подходит (короткие/длинные/ТОПы/кейсы);
- что нужно делать, чтобы этот сегмент рос.

## 4. Контент-паттерны, которые нравятся (5–10 паттернов)
Для каждого:
- в чём суть паттерна (подача, эмоции, сюжет);
- какие видео подтверждают;
- почему аудитория реагирует именно так;
- что можно масштабировать.

## 5. Контент, который НЕ работает (4–8 антипаттернов)
Для каждого:
- какие видео дают минимальный отклик (примеры);
- общие характеристики;
- почему не работает;
- что делать вместо этого.

## 6. Поведенческая аналитика (4–8 пунктов)
- реакция на длительность;
- реакция на сложность;
- реакция на форматы заголовков;
- вовлечённость и её распределение;
- предпочтения по темпоритму;
- признаки усталости.

## 7. Возможности роста (5–10 пунктов)
Конкретные шансы увеличить охват на основе данных:
- короткие видео по темам где работают длинные;
- вводные серии для новичков;
- циклы по вовлекающим паттернам;
- вирусные темы → расширение аудитории.

## 8. Что делать прямо сейчас (5–12 рекомендаций)
Формат:
- Действие (что делать)
- Основание (какие видео/данные подтверждают)
- Ожидаемый эффект (конверсия/вовлечённость/рост)

---

# ПРАВИЛА РАБОТЫ:
1. Никаких фантазий — только по переданным данным.
2. Анализ должен быть прикладным, не академическим.
3. Ценность как отчёт консультанта (30–50 тыс. руб).
4. Все выводы базируются на конкретных видео из выборки.

---

# ДАННЫЕ:

${JSON.stringify(videosForAnalysis, null, 2)}

---

Возвращай ответ ТОЛЬКО в виде JSON с ключами (на английском), значения полностью на русском:
{
  "audienceProfile": "Краткий профиль...",
  "motivations": ["Мотив 1...", "Мотив 2...", ...],
  "segments": ["Сегмент 1: ...", "Сегмент 2: ...", ...],
  "contentPatterns": ["Паттерн 1...", "Паттерн 2...", ...],
  "antiPatterns": ["Антипаттерн 1...", "Антипаттерн 2...", ...],
  "behavioralAnalytics": ["Поведение 1...", "Поведение 2...", ...],
  "growthOpportunities": ["Возможность 1...", "Возможность 2...", ...],
  "actionableRecommendations": ["1. Действие: ...", "2. Действие: ...", ...]
}`;

    // Вызов OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.6,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log(`[Audience] Получен ответ от OpenAI`);

    // TODO [PROD]: Убедиться что JSON парсится корректно
    // Если модель вернёт невалидный JSON, весь запрос упадёт
    // Можно добавить try-catch и fallback анализ если нужно
    const aiAnalysis = JSON.parse(responseText);

    // Формируем итоговые данные
    const audienceData = {
      highEngagementVideos: highEngagementVideos.slice(0, 10).map(v => ({
        title: v.title,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
        engagementScore: v.engagementScore,
        likeRate: v.likeRate,
        commentRate: v.commentRate,
        viewsPerDay: v.viewsPerDay,
        publishedAt: v.publishedAt,
      })),
      stats: {
        totalAnalyzed: videos.length,
        highEngagement: highEngagementVideos.length,
        rising: videosWithMetrics.filter(v => v.category === "Rising").length,
        weak: videosWithMetrics.filter(v => v.category === "Weak").length,
        medianEngagement: medianEngagement,
      },
      usingFallback, // Флаг для UI
      ...aiAnalysis,
    };

    // Сохраняем результат в базу данных
    await client.execute({
      sql: "INSERT INTO audience_insights (channelId, data, data_ru, generatedAt) VALUES (?, ?, ?, ?)",
      args: [competitor.channelId, JSON.stringify(audienceData), null, Date.now()],
    });

    console.log(`[Audience] Анализ сохранён в БД`);

    client.close();

    // Возвращаем результат клиенту
    return NextResponse.json({
      ...audienceData,
      generatedAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    client.close();
    console.error("[Audience] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate audience analysis" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/audience
 * Возвращает существующий audience анализ
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
      sql: "SELECT * FROM audience_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const analysis = analysisResult.rows[0];

    console.log(`[Audience GET] Найден анализ для channelId: ${competitor.channelId}, hasDataRu: ${!!analysis.data_ru}`);

    // Возвращаем обе версии (EN и RU) в сыром виде, UI сам выберет нужную
    const response: any = {
      generatedAt: analysis.generatedAt,
      hasRussianVersion: !!analysis.data_ru,
      data: analysis.data, // Английский JSON как строка
    };

    // Возвращаем data_ru если есть
    if (analysis.data_ru) {
      response.data_ru = analysis.data_ru; // Русский JSON как строка
      console.log(`[Audience GET] data_ru найден, длина: ${(analysis.data_ru as string).length} символов`);
    }

    // Для обратной совместимости добавляем распарсенные поля основного анализа
    const parsed = JSON.parse(analysis.data as string);
    Object.assign(response, parsed);

    client.close();

    return NextResponse.json(response);

  } catch (error) {
    client.close();
    console.error("[Audience] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch audience analysis" },
      { status: 500 }
    );
  }
}
