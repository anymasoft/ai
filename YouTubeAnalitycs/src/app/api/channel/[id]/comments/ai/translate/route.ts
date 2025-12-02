import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/channel/[id]/comments/ai/translate
 * Переводит английский анализ на указанный язык через GPT
 */
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

    // Получаем язык из body
    const body = await req.json();
    const targetLanguage = body.language as string;

    if (!targetLanguage || targetLanguage !== "ru") {
      return NextResponse.json(
        { error: "Invalid language. Only 'ru' is supported." },
        { status: 400 }
      );
    }

    console.log(`[TranslateAPI] Запрос перевода для competitor ID: ${competitorId}, язык: ${targetLanguage}`);

    // Подключаемся к БД
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем channelId конкурента
    const competitorResult = await client.execute({
      sql: `SELECT channelId FROM competitors WHERE id = ? AND userId = ?`,
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

    // Получаем последний анализ с analysis_en
    const analysisResult = await client.execute({
      sql: `SELECT analysis_en, analysis_ru
            FROM channel_ai_comment_insights
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "No English analysis found. Please generate analysis first." },
        { status: 404 }
      );
    }

    const row = analysisResult.rows[0];
    const analysisEn = row.analysis_en as string | null;
    const existingRu = row.analysis_ru as string | null;

    // Проверяем наличие английского анализа
    if (!analysisEn) {
      client.close();
      return NextResponse.json(
        { error: "English analysis is empty. Please regenerate analysis." },
        { status: 400 }
      );
    }

    // Если уже есть русский перевод, возвращаем его
    if (existingRu) {
      client.close();
      console.log(`[TranslateAPI] Русский перевод уже существует, возвращаем из кэша`);
      return NextResponse.json({
        analysis: JSON.parse(existingRu),
        cached: true,
      });
    }

    console.log(`[TranslateAPI] Начинаем перевод через GPT...`);

    // Переводим через GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following JSON object from English to Russian.
Translate ALL text fields while preserving the JSON structure and field names.
Return ONLY the translated JSON without any additional text or markdown formatting.`,
        },
        {
          role: "user",
          content: analysisEn,
        },
      ],
      temperature: 0.3,
    });

    const translatedJson = completion.choices[0]?.message?.content?.trim();

    if (!translatedJson) {
      client.close();
      return NextResponse.json(
        { error: "Translation failed: empty response from GPT" },
        { status: 500 }
      );
    }

    console.log(`[TranslateAPI] Перевод завершён, сохраняем в БД...`);

    // Сохраняем перевод в БД
    await client.execute({
      sql: `UPDATE channel_ai_comment_insights
            SET analysis_ru = ?
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [translatedJson, channelId],
    });

    client.close();

    console.log(`[TranslateAPI] Перевод успешно сохранён`);

    // Возвращаем переведённый анализ
    return NextResponse.json(
      {
        analysis: JSON.parse(translatedJson),
        cached: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[TranslateAPI] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to translate analysis" },
      { status: 500 }
    );
  }
}
