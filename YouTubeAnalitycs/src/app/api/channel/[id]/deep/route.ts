import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { createClient } from "@libsql/client";

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

    console.log(`[DeepAudience] Запрос анализа для competitor ID: ${competitorId}`);

    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

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
    const channelId = competitor.channelId as string;
    const title = competitor.title as string;

    console.log(`[DeepAudience] Канал найден: ${title}`);

    // Проверяем свежий анализ (не старше 7 дней)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const existingResult = await client.execute({
      sql: "SELECT * FROM deep_audience WHERE channelId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [channelId],
    });

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const createdAt = existing.createdAt as number;

      if (createdAt > sevenDaysAgo) {
        console.log(`[DeepAudience] Найден свежий анализ`);
        client.close();
        return NextResponse.json({
          ...JSON.parse(existing.data as string),
          createdAt: createdAt,
        });
      }
    }

    console.log(`[DeepAudience] Генерируем новый анализ через OpenAI...`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Ты — эксперт по анализу аудитории YouTube. Предоставляй глубокую аналитику о поведении, предпочтениях и паттернах аудитории. ВАЖНО: Отвечай СТРОГО на русском языке. Возвращай JSON с английскими ключами, но ВСЕ значения должны быть на русском языке."
        },
        {
          role: "user",
          content: `Проанализируй аудиторию YouTube канала "${title}". Предоставь insights в формате JSON с этими полями:
- audienceProfile: массив характеристик аудитории
- contentPreferences: массив того, что нравится аудитории
- engagementPatterns: массив паттернов взаимодействия аудитории
- recommendations: массив практических рекомендаций

Возвращай ТОЛЬКО JSON без дополнительного текста.`
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

    console.log(`[DeepAudience] Получен ответ от OpenAI`);

    const aiAnalysis = JSON.parse(responseText);

    const deepAudienceData = {
      ...aiAnalysis,
      totalAnalyzed: 1,
      channelTitle: title,
    };

    // Сохраняем результат
    await client.execute({
      sql: "INSERT INTO deep_audience (channelId, data, data_ru, createdAt) VALUES (?, ?, ?, ?)",
      args: [channelId, JSON.stringify(deepAudienceData), null, Date.now()],
    });

    console.log(`[DeepAudience] Анализ сохранён в БД`);

    client.close();

    return NextResponse.json({
      ...deepAudienceData,
      createdAt: Date.now(),
    }, { status: 201 });

  } catch (error) {
    console.error("[DeepAudience] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate deep audience analysis" },
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

    const channelId = competitorResult.rows[0].channelId as string;

    // Получаем последний анализ
    const analysisResult = await client.execute({
      sql: "SELECT * FROM deep_audience WHERE channelId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ analysis: null });
    }

    const analysis = analysisResult.rows[0];

    console.log(`[DeepAudience GET] Найден анализ для channelId: ${channelId}, hasDataRu: ${!!analysis.data_ru}`);

    const response: any = {
      createdAt: analysis.createdAt,
      hasRussianVersion: !!analysis.data_ru,
      data: analysis.data,
    };

    if (analysis.data_ru) {
      response.data_ru = analysis.data_ru;
      console.log(`[DeepAudience GET] data_ru найден, длина: ${(analysis.data_ru as string).length} символов`);
    }

    const parsed = JSON.parse(analysis.data as string);
    Object.assign(response, parsed);

    client.close();

    return NextResponse.json(response);

  } catch (error) {
    console.error("[DeepAudience] Ошибка GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch deep audience analysis" },
      { status: 500 }
    );
  }
}
