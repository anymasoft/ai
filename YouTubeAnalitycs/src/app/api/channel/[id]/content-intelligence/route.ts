import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

const SYSTEM_PROMPT = `Ты — аналитик контента и специалист по стратегии YouTube с опытом более 10 лет. Твоя задача — создать профессиональный аналитический отчёт об особенностях контент-стратегии YouTube канала, основанный ИСКЛЮЧИТЕЛЬНО на предоставленных данных.

**КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:**
1. Отвечай ТОЛЬКО на русском языке
2. Анализируй ТОЛЬКО реальные данные из набора видео (без предположений и галлюцинаций)
3. Не используй общие фразы типа "важно делать интересный контент"
4. Все рекомендации должны быть привязаны к конкретным паттернам из данных
5. Сравнивай показатели видео внутри набора данных, а не с абстрактными YouTube метриками
6. Указывай конкретные числа, проценты, тренды

**ФОРМАТ ОТВЕТА:**
Используй markdown формат с чёткой структурой из 7 разделов. Каждый раздел должен содержать практичные, специфичные выводы.

**СТИЛЬ И ТОНАЛЬНОСТЬ:**
Профессиональный, как консультант, готовящий отчёт стоимостью 30-50 тыс. рублей. Акцент на "почему это работает" и "как это использовать".`;

const USER_PROMPT_TEMPLATE = (title: string, videosData: string) => `Проведи углубленный анализ топ-видео канала "${title}" и создай структурированный отчет.

**⚠️ ВАЖНО: ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ К ФОРМАТУ ОТВЕТА**
Твой ответ ДОЛЖЕН содержать ровно две части:

ЧАСТЬ 1 - Текстовый отчёт (7 разделов)
ЧАСТЬ 2 - JSON с табличными данными (после маркера __TABLES_JSON__)

Вторая часть ОБЯЗАТЕЛЬНА и не должна быть пропущена!

---

**ДАННЫЕ ДЛЯ АНАЛИЗА:**
${videosData}

**СТРУКТУРА ОТЧЕТА (обязательно 7 разделов в этом порядке):**

## 1. РЕЗЮМЕ (summary)
Краткое резюме (3-5 предложений) с описанием основного тренда контента канала, его позиционирования и ключевой аудитории. Должно содержать конкретные цифры из данных.

## 2. ОСНОВНЫЕ ТЕМЫ (themes)
Перечисли 5-10 основных тем контента. Для каждой темы напиши:
- Название темы (реальное название из названий видео)
- Количество видео на эту тему
- Средний просмотр
- Описание тренда

Не пытайся форматировать как markdown таблицу - это будет в JSON части!

## 3. ФОРМАТЫ КОНТЕНТА (formats)
Определи 4-8 основных форматов (структур) видео. Для каждого формата напиши:
- Тип формата (обзор, туториал, влог, интервью, челлендж и т.д.)
- Количество видео этого формата
- Средний просмотр для формата
- Описание особенностей

Не пытайся форматировать как markdown таблицу - это будет в JSON части!

## 4. ПОВТОРЯЮЩИЕСЯ ПАТТЕРНЫ (patterns)
Выдели 5-8 явных паттернов успешных видео:
- Длина названия (примеры реальных названий)
- Ключевые слова, которые часто появляются в популярных видео
- Время публикации (если видны тренды)
- Структурные элементы названий (вопрос, цифра, запрос и т.д.)
- Временной промежуток между публикациями

## 5. СЛАБЫЕ СТОРОНЫ (weaknesses)
Определи то, что канал делает хуже других вариантов:
- Какие темы дают меньше всего просмотров и почему
- Какие форматы недоиспользуются
- Видео с аномально низкими просмотрами (почему)
- Потенциальные "мёртвые зоны" контента

## 6. ВОЗМОЖНОСТИ (opportunities)
Какие недозаполненные ниши или неиспользованные потенциалы видны в данных:
- Темы, которые популярны, но редко освещаются
- Комбинации форматов, которые не пробовались
- Потенциально популярные расширения текущих тем
- Временные окна для публикаций

## 7. РЕКОМЕНДАЦИИ (recommendations)
Конкретные, практичные рекомендации основанные на анализе (5-8 пунктов):
- Каких видео стоит снять первым делом и почему
- Какие название/формата комбинации дают наибольший потенциал
- Как оптимизировать расписание публикаций
- Какие успешные элементы из топ видео нужно использовать в новых видео

**ВАЖНО:**
- Если видео мало (менее 10), явно укажи, что анализ имеет ограничения из-за малого набора данных
- Не пытайся предсказывать, исходя из предположений - только факты из данных
- Каждый пункт должен быть подтвережден конкретными примерами из названий видео

---

## ✅ ОБЯЗАТЕЛЬНО: JSON С ТАБЛИЧНЫМИ ДАННЫМИ

ЭТО САМОЕ ВАЖНОЕ ТРЕБОВАНИЕ! Без JSON твой ответ будет неполным.

**ТОЧНЫЙ ФОРМАТ ОТВЕТА:**

1. Напиши полный текстовый отчёт (все 7 разделов).
2. На НОВОЙ СТРОКЕ выведи: __TABLES_JSON__
3. На СЛЕДУЮЩЕЙ СТРОКЕ выведи ВАЛИДНЫЙ JSON (ничего кроме JSON!)
4. JSON содержит ВСЕ ТАБЛИЧНЫЕ ДАННЫЕ из разделов 2 и 3

**JSON СХЕМА (ТОЧНО СЛЕДУЙ ЭТОМУ ФОРМАТУ):**

{
  "themes": [
    {
      "name": "Полное название темы из видео",
      "videoCount": 23,
      "avgViews": 1420,
      "trend": "Описание тренда на русском языке"
    }
  ],
  "formats": [
    {
      "name": "Название формата",
      "videoCount": 10,
      "avgViews": 2000,
      "features": "Описание особенностей формата"
    }
  ]
}

**КРИТИЧЕСКИЕ ПРАВИЛА JSON:**

- ТОЛЬКО валидный JSON! Проверь синтаксис!
- videoCount и avgViews - ТОЛЬКО целые числа (без ~, без текста, без запятых!)
- Пример ПРАВИЛЬНО: "videoCount": 23, "avgViews": 1420
- Пример НЕПРАВИЛЬНО: "videoCount": "23 видео", "avgViews": "~1420"
- name, trend, features - текстовые строки на русском
- Если тем нет - выведи: "themes": []
- Если форматов нет - выведи: "formats": []
- НЕ добавляй комментарии или текст вне JSON
- JSON должен быть в одной строке или красиво отформатирован - оба варианта OK

**ПРАВИЛЬНЫЙ ПРИМЕР ПОЛНОГО ОТВЕТА:**

## 1. РЕЗЮМЕ (summary)
Канал фокусируется на парном трейдинге...

## 2. ОСНОВНЫЕ ТЕМЫ (themes)
К этому разделу относятся темы:
- Парный трейдинг (23 видео, ~1420 просмотров, растёт)
- Рекомендованные стратегии (7 видео, ~2200 просмотров, растёт)

## 3. ФОРМАТЫ КОНТЕНТА (formats)
Основные форматы:
- Обзоры (10 видео, ~2000 просмотров, технический контент)
- Туториалы (5 видео, ~1500 просмотров, пошаговое обучение)

## 4-7. [остальные разделы...]

__TABLES_JSON__
{"themes":[{"name":"Парный трейдинг","videoCount":23,"avgViews":1420,"trend":"Стабильный с пиками на видео с результатами"},{"name":"Рекомендованные стратегии","videoCount":7,"avgViews":2200,"trend":"Растущий тренд"}],"formats":[{"name":"Обзор","videoCount":10,"avgViews":2000,"features":"Технический анализ"},{"name":"Туториал","videoCount":5,"avgViews":1500,"features":"Пошаговое обучение"}]}`;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log("[ContentIntelligence] === POST HANDLER CALLED ===");

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log("[ContentIntelligence] Ошибка: нет сессии");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      console.log("[ContentIntelligence] Ошибка: некорректный ID");
      return NextResponse.json(
        { ok: false, error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[ContentIntelligence] Запрос анализа для competitor ID: ${competitorId}`);

    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

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
    const channelId = competitor.channelId as string;
    const title = competitor.title as string;

    console.log(`[ContentIntelligence] Канал найден: ${title}`);

    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channelId = ? ORDER BY viewCountInt DESC LIMIT 50",
      args: [channelId],
    });

    if (videosResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Sync Top Videos first" },
        { status: 400 }
      );
    }

    console.log(`[ContentIntelligence] Найдено ${videosResult.rows.length} видео для анализа`);

    // TODO [PROD]: Включить кеширование перед production развертыванием
    // const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // const existingResult = await client.execute({
    //   sql: "SELECT * FROM content_intelligence WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
    //   args: [channelId],
    // });

    // if (existingResult.rows.length > 0) {
    //   const existing = existingResult.rows[0];
    //   const generatedAt = existing.generatedAt as number;

    //   if (generatedAt > sevenDaysAgo) {
    //     console.log(`[ContentIntelligence] Найден свежий анализ`);
    //     client.close();
    //     return NextResponse.json({
    //       ...JSON.parse(existing.data as string),
    //       generatedAt: generatedAt,
    //     });
    //   }
    // }

    console.log(`[ContentIntelligence] Генерируем новый анализ через OpenAI...`);

    const videosData = videosResult.rows.map(v => ({
      title: v.title,
      viewCount: v.viewCountInt,
      publishDate: v.publishDate,
    }));

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: USER_PROMPT_TEMPLATE(title, JSON.stringify(videosData, null, 2)),
        }
      ],
      temperature: 0.6,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      client.close();
      throw new Error("No response from OpenAI");
    }

    console.log(`[ContentIntelligence] Получен ответ от OpenAI (${responseText.length} символов)`);

    // Парсим JSON с таблицами из ответа
    let tablesJson: any = null;
    const markerIndex = responseText.indexOf("__TABLES_JSON__");
    let reportText = responseText;

    if (markerIndex !== -1) {
      reportText = responseText.substring(0, markerIndex).trim();
      const jsonPart = responseText.substring(markerIndex + "__TABLES_JSON__".length).trim();

      try {
        tablesJson = JSON.parse(jsonPart);
        console.log(`[ContentIntelligence] JSON с таблицами успешно распарсен`);
      } catch (e) {
        console.warn(`[ContentIntelligence] Не удалось распарсить JSON с таблицами:`, e);
        // Продолжаем с пустым tablesJson, это не критично
      }
    }

    // Сохраняем markdown отчёт в БД
    const analysisData = {
      report: reportText,
      format: "markdown",
      sections: [
        "summary",
        "themes",
        "formats",
        "patterns",
        "weaknesses",
        "opportunities",
        "recommendations"
      ],
      ...(tablesJson && { tables: tablesJson })
    };

    const now = Date.now();
    await client.execute({
      sql: "INSERT INTO content_intelligence (channelId, data, data_ru, generatedAt) VALUES (?, ?, ?, ?)",
      args: [channelId, JSON.stringify(analysisData), null, now],
    });

    console.log(`[ContentIntelligence] Анализ сохранён в БД`);

    // Обновляем состояние пользователя: отмечаем, что он выполнил синхронизацию контент-аналитики
    try {
      await client.execute({
        sql: `INSERT INTO user_channel_content_state (userId, channelId, hasShownContent, lastSyncAt)
              VALUES (?, ?, 0, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET lastSyncAt = ?`,
        args: [session.user.id, channelId, now, now],
      });
      console.log(`[ContentIntelligence] Обновлено состояние пользователя: lastSyncAt = ${new Date(now).toISOString()} для channelId=${channelId}`);
    } catch (stateError) {
      console.warn(`[ContentIntelligence] Ошибка при обновлении состояния пользователя:`, stateError instanceof Error ? stateError.message : stateError);
      // Не прерываем выполнение - анализ уже сохранён
    }

    client.close();

    const successResponse = {
      ok: true,
      report: reportText,
      format: "markdown",
      ...(tablesJson && { tables: tablesJson }),
      generatedAt: Date.now(),
    };

    console.log("[ContentIntelligence] === УСПЕШНЫЙ ОТВЕТ ===");
    console.log("[ContentIntelligence] report.length:", reportText.length);
    console.log("[ContentIntelligence] response object keys:", Object.keys(successResponse));

    return NextResponse.json(successResponse, { status: 201 });

  } catch (error) {
    console.error("[ContentIntelligence] === ОШИБКА В CATCH ===");
    console.error("[ContentIntelligence] error type:", typeof error);
    console.error("[ContentIntelligence] error instanceof Error:", error instanceof Error);

    if (error instanceof Error) {
      console.error("[ContentIntelligence] error.message:", error.message);
      console.error("[ContentIntelligence] error.stack:", error.stack);
    } else {
      console.error("[ContentIntelligence] error value:", String(error));
    }

    const errorMessage = error instanceof Error
      ? (error.message || "Failed to generate content intelligence")
      : String(error) || "Failed to generate content intelligence";

    const errorResponse = {
      ok: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    console.log("[ContentIntelligence] === ВОЗВРАЩАЕМ ОШИБКУ ===");
    console.log("[ContentIntelligence] errorResponse:", errorResponse);

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log("[ContentIntelligence] === GET HANDLER CALLED ===");

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log("[ContentIntelligence] Ошибка GET: нет сессии");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      console.log("[ContentIntelligence] Ошибка GET: некорректный ID");
      return NextResponse.json(
        { ok: false, error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      console.log("[ContentIntelligence] Ошибка GET: конкурент не найден");
      return NextResponse.json(
        { ok: false, error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    const channelId = competitorResult.rows[0].channelId as string;

    const analysisResult = await client.execute({
      sql: "SELECT * FROM content_intelligence WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      console.log("[ContentIntelligence] GET: анализ не найден для канала");
      return NextResponse.json({ ok: false, analysis: null, error: "No analysis found" });
    }

    const analysis = analysisResult.rows[0];

    client.close();

    const parsedData = JSON.parse(analysis.data as string);

    // Поддержка обоих форматов: старый JSON и новый markdown
    if (parsedData.format === "markdown" && parsedData.report) {
      const getResponse = {
        ok: true,
        report: parsedData.report,
        format: "markdown",
        ...(parsedData.tables && { tables: parsedData.tables }),
        generatedAt: analysis.generatedAt,
      };
      console.log("[ContentIntelligence] === GET УСПЕШНЫЙ ОТВЕТ (markdown) ===");
      console.log("[ContentIntelligence] response keys:", Object.keys(getResponse));
      return NextResponse.json(getResponse);
    }

    // Для обратной совместимости со старым JSON форматом
    const compatResponse = {
      ok: true,
      ...parsedData,
      generatedAt: analysis.generatedAt,
    };
    console.log("[ContentIntelligence] === GET УСПЕШНЫЙ ОТВЕТ (legacy) ===");
    console.log("[ContentIntelligence] response keys:", Object.keys(compatResponse));
    return NextResponse.json(compatResponse);

  } catch (error) {
    console.error("[ContentIntelligence] === ОШИБКА В GET CATCH ===");
    console.error("[ContentIntelligence] error type:", typeof error);
    console.error("[ContentIntelligence] error instanceof Error:", error instanceof Error);

    if (error instanceof Error) {
      console.error("[ContentIntelligence] error.message:", error.message);
      console.error("[ContentIntelligence] error.stack:", error.stack);
    } else {
      console.error("[ContentIntelligence] error value:", String(error));
    }

    const errorMessage = error instanceof Error
      ? (error.message || "Failed to fetch content intelligence")
      : String(error) || "Failed to fetch content intelligence";

    const errorResponse = {
      ok: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    console.log("[ContentIntelligence] === ВОЗВРАЩАЕМ ОШИБКУ GET ===");
    console.log("[ContentIntelligence] errorResponse:", errorResponse);

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
