import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

export async function POST(
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
      sql: "SELECT * FROM channel_videos WHERE channelId = ? ORDER BY viewCount DESC LIMIT 50",
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

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const existingResult = await client.execute({
      sql: "SELECT * FROM content_intelligence WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [channelId],
    });

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const generatedAt = existing.generatedAt as number;

      if (generatedAt > sevenDaysAgo) {
        console.log(`[ContentIntelligence] Найден свежий анализ`);
        client.close();
        return NextResponse.json({
          ...JSON.parse(existing.data as string),
          generatedAt: generatedAt,
        });
      }
    }

    console.log(`[ContentIntelligence] Генерируем новый анализ через OpenAI...`);

    const videosData = videosResult.rows.map(v => ({
      title: v.title,
      viewCount: v.viewCount,
      publishedAt: v.publishedAt,
    }));

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `Ты — аналитик контента и специалист по стратегии YouTube с опытом более 10 лет. Твоя задача — создать профессиональный аналитический отчёт об особенностях контент-стратегии YouTube канала, основанный ИСКЛЮЧИТЕЛЬНО на предоставленных данных.

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
Профессиональный, как консультант, готовящий отчёт стоимостью 30-50 тыс. рублей. Акцент на "почему это работает" и "как это использовать".`
        },
        {
          role: "user",
          content: `Проведи углубленный анализ топ-видео канала "${title}" и создай структурированный отчет.

**ДАННЫЕ ДЛЯ АНАЛИЗА:**
${JSON.stringify(videosData, null, 2)}

**СТРУКТУРА ОТЧЕТА (обязательно 7 разделов в этом порядке):**

## 1. РЕЗЮМЕ (summary)
Краткое резюме (3-5 предложений) с описанием основного тренда контента канала, его позиционирования и ключевой аудитории. Должно содержать конкретные цифры из данных.

## 2. ОСНОВНЫЕ ТЕМЫ (themes)
Выдели 5-10 основных тем контента в виде таблицы Markdown. ТАБЛИЦА ДОЛЖНА ИМЕТЬ ТОЧНО ТАКУЮ СТРУКТУРУ:

| Тема | Видео | Просмотры | Тренд |
|------|-------|-----------|-------|
| Название1 | 10 | 1200 | Растёт |
| Название2 | 5 | 800 | Падает |

**КРИТИЧЕСКОЕ ТРЕБОВАНИЕ:**
- Первая строка: `| Тема | Видео | Просмотры | Тренд |`
- Вторая строка ДОЛЖНА быть: `|------|-------|-----------|-------|` (дефисы минимум 3 для каждого столбца, разделены "|")
- НЕ используй длинные непрерывные строки дефисов вроде `|-----|------------|`
- Каждая строка данных: `| текст | число | число | текст |`

Для каждой темы:
- Название темы (реальное название из названий видео)
- Количество видео
- Средний просмотр (число)
- Тренд (одно из: Растёт, Падает, Стабильна)

## 3. ФОРМАТЫ КОНТЕНТА (formats)
Определи 4-8 основных форматов (структур) видео в виде таблицы Markdown. ТАБЛИЦА ДОЛЖНА ИМЕТЬ ТОЧНО ТАКУЮ СТРУКТУРУ:

| Формат | Видео | Просмотры | Особенности |
|--------|-------|-----------|-------------|
| Обзор | 10 | 2000 | Технический контент |
| Туториал | 5 | 1500 | Пошаговое обучение |

**КРИТИЧЕСКОЕ ТРЕБОВАНИЕ:**
- Первая строка: `| Формат | Видео | Просмотры | Особенности |`
- Вторая строка ДОЛЖНА быть: `|--------|-------|-----------|-------------|` (дефисы минимум 3 для каждого столбца, разделены "|")
- НЕ используй длинные непрерывные строки дефисов вроде `|-----------|------------|`
- Каждая строка данных: `| текст | число | число | текст |`

Для каждого формата:
- Тип формата (обзор, туториал, влог, интервью, челлендж и т.д.)
- Количество видео этого формата
- Средний просмотр для формата
- Краткое описание особенностей

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

**ПРАВИЛА ДЛЯ ВЫВОДА MARKDOWN-ТАБЛИЦ (строго соблюдать):**
Если в ответе присутствуют markdown-таблицы:

1. Каждая строка таблицы должна быть на отдельной строке.
2. Между строками таблицы ОБЯЗАТЕЛЬНО использовать символ перевода строки (\\n).
3. Формат обязателен:
\`\`\`
| Колонка 1 | Колонка 2 | Колонка 3 |
|---|---|---|
| Значение 1 | Значение 2 | Значение 3 |
| Значение A | Значение B | Значение C |
\`\`\`

4. НЕЛЬЗЯ выводить таблицу одной строкой.
5. НЕЛЬЗЯ объединять строки таблицы через пробел.
6. После каждой строки таблицы ДОЛЖЕН быть перевод строки.
7. Если таблица не может быть корректно выведена — не выводи её вообще.

Эти правила критичны для правильного отображения таблиц в пользовательском интерфейсе.`
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

    // Сохраняем markdown отчёт в БД
    const analysisData = {
      report: responseText,
      format: "markdown",
      sections: [
        "summary",
        "themes",
        "formats",
        "patterns",
        "weaknesses",
        "opportunities",
        "recommendations"
      ]
    };

    await client.execute({
      sql: "INSERT INTO content_intelligence (channelId, data, data_ru, generatedAt) VALUES (?, ?, ?, ?)",
      args: [channelId, JSON.stringify(analysisData), null, Date.now()],
    });

    console.log(`[ContentIntelligence] Анализ сохранён в БД`);

    client.close();

    return NextResponse.json({
      report: responseText,
      format: "markdown",
      generatedAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    console.error("[ContentIntelligence] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate content intelligence" },
      { status: 500 }
    );
  }
}

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

    const channelId = competitorResult.rows[0].channelId as string;

    const analysisResult = await client.execute({
      sql: "SELECT * FROM content_intelligence WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const analysis = analysisResult.rows[0];

    client.close();

    const parsedData = JSON.parse(analysis.data as string);

    // Поддержка обоих форматов: старый JSON и новый markdown
    if (parsedData.format === "markdown" && parsedData.report) {
      return NextResponse.json({
        report: parsedData.report,
        format: "markdown",
        generatedAt: analysis.generatedAt,
      });
    }

    // Для обратной совместимости со старым JSON форматом
    return NextResponse.json({
      ...parsedData,
      generatedAt: analysis.generatedAt,
    });

  } catch (error) {
    console.error("[ContentIntelligence] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch content intelligence" },
      { status: 500 }
    );
  }
}
