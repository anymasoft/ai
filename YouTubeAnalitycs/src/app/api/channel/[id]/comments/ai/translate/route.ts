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

    // Получаем последний анализ с analysis_en, analysis_ru и resultJson (для fallback)
    const analysisResult = await client.execute({
      sql: `SELECT analysis_en, analysis_ru, resultJson
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
    let analysisEn = row.analysis_en as string | null;
    const existingRu = row.analysis_ru as string | null;
    const resultJson = row.resultJson as string | null;

    // Fallback для старых записей: если analysis_en пустой, но есть resultJson
    if (!analysisEn && resultJson) {
      console.log(`[TranslateAPI] Найдена старая запись без analysis_en, мигрируем из resultJson`);

      // Мигрируем данные: сохраняем resultJson как analysis_en
      await client.execute({
        sql: `UPDATE channel_ai_comment_insights
              SET analysis_en = ?
              WHERE channelId = ?
              AND id = (
                SELECT id FROM channel_ai_comment_insights
                WHERE channelId = ?
                ORDER BY createdAt DESC
                LIMIT 1
              )`,
        args: [resultJson, channelId, channelId],
      });

      // Используем resultJson как источник для перевода
      analysisEn = resultJson;
      console.log(`[TranslateAPI] Миграция завершена, используем resultJson для перевода`);
    }

    // Проверяем наличие английского анализа (после fallback)
    if (!analysisEn || analysisEn.trim().length === 0) {
      console.error('[TranslateAPI] English analysis is empty even after migration');
      client.close();
      return NextResponse.json(
        { error: "No English analysis available. Please run Deep Analysis first." },
        { status: 400 }
      );
    }

    // Если уже есть русский перевод, возвращаем успех
    if (existingRu) {
      client.close();
      console.log(`[TranslateAPI] Русский перевод уже существует`);
      return NextResponse.json({ ok: true, cached: true });
    }

    console.log(`[TranslateAPI] Начинаем перевод через GPT...`);

    // Переводим через GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a translation engine.
Translate the JSON below to Russian.
Do not change structure, keys or format.
Only replace English strings with Russian ones.
Return ONLY valid JSON.`,
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

    // Находим id последней записи
    const selectResult = await client.execute({
      sql: `SELECT id FROM channel_ai_comment_insights
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    if (selectResult.rows.length === 0) {
      console.error('[TranslateAPI] No record found for channelId:', channelId);
      client.close();
      return NextResponse.json(
        { error: 'No analysis record found for this channel. Please run Deep Analysis first.' },
        { status: 400 }
      );
    }

    const recordId = selectResult.rows[0].id;

    // Обновляем запись по id
    await client.execute({
      sql: `UPDATE channel_ai_comment_insights
            SET analysis_ru = ?
            WHERE id = ?`,
      args: [translatedJson, recordId],
    });

    console.log('[TranslateAPI] Saved Russian translation for record', recordId);

    client.close();

    console.log(`[TranslateAPI] Перевод успешно сохранён`);

    // Возвращаем успех
    return NextResponse.json({ ok: true });
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
