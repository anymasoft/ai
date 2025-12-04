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
        { error: "No videos found. Please sync videos first." },
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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты — эксперт по анализу YouTube контента. Твоя задача — выявить паттерны успешных видео."
        },
        {
          role: "user",
          content: `Проанализируй топ-видео YouTube канала "${title}" и выдели:

1) ключевые темы (themes) - о чем чаще всего снимают видео
2) форматы (formats) - какие типы контента используются (обзоры, туториалы, влоги, и т.д.)
3) повторяющиеся паттерны (patterns) - что общего у популярных видео (длина названий, ключевые слова, структура)
4) какие темы дают больше всего просмотров (opportunities)
5) конкретные рекомендации — что стоит снять автору канала (recommendations)

Видео для анализа:
${JSON.stringify(videosData, null, 2)}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "themes": ["тема 1", "тема 2", ...],
  "formats": ["формат 1", "формат 2", ...],
  "patterns": ["паттерн 1", "паттерн 2", ...],
  "opportunities": ["возможность 1", "возможность 2", ...],
  "recommendations": ["рекомендация 1", "рекомендация 2", ...]
}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      client.close();
      throw new Error("No response from OpenAI");
    }

    console.log(`[ContentIntelligence] Получен ответ от OpenAI`);

    const analysisData = JSON.parse(responseText);

    await client.execute({
      sql: "INSERT INTO content_intelligence (channelId, data, generatedAt) VALUES (?, ?, ?)",
      args: [channelId, JSON.stringify(analysisData), Date.now()],
    });

    console.log(`[ContentIntelligence] Анализ сохранён в БД`);

    client.close();

    return NextResponse.json({
      ...analysisData,
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

    return NextResponse.json({
      ...JSON.parse(analysis.data as string),
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
