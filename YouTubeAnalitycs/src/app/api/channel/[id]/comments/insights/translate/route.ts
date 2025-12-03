import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/channel/[id]/comments/insights/translate
 * Переводит Comment Insights анализ на русский язык через GPT
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

    const body = await req.json();
    const targetLanguage = body.targetLanguage as string;

    if (!targetLanguage || targetLanguage !== "ru") {
      return NextResponse.json(
        { error: "Invalid language. Only 'ru' is supported." },
        { status: 400 }
      );
    }

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

    // Получаем последний анализ с data и data_ru
    const analysisResult = await client.execute({
      sql: `SELECT data, data_ru
            FROM comment_insights
            WHERE channelId = ?
            ORDER BY generatedAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    if (analysisResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "No Comment Insights analysis found. Please generate analysis first." },
        { status: 404 }
      );
    }

    const row = analysisResult.rows[0];
    const dataEn = row.data as string | null;
    const existingRu = row.data_ru as string | null;

    if (!dataEn) {
      client.close();
      return NextResponse.json(
        { error: "English analysis is empty. Please regenerate analysis." },
        { status: 400 }
      );
    }

    // Если уже есть русский перевод, возвращаем его
    if (existingRu) {
      client.close();
      return NextResponse.json({
        data: JSON.parse(existingRu),
        cached: true,
      });
    }

    // Переводим через GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following JSON object from English to Russian.
Translate ALL text fields while preserving the JSON structure and field names.
Do not shorten, summarize or add anything.
Return ONLY the translated JSON without any additional text or markdown formatting.`,
        },
        {
          role: "user",
          content: dataEn,
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

    // Сохраняем перевод в БД
    await client.execute({
      sql: `UPDATE comment_insights
            SET data_ru = ?
            WHERE channelId = ?
            AND id = (
              SELECT id FROM comment_insights
              WHERE channelId = ?
              ORDER BY generatedAt DESC
              LIMIT 1
            )`,
      args: [translatedJson, channelId, channelId],
    });

    client.close();

    return NextResponse.json(
      {
        data: JSON.parse(translatedJson),
        cached: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CommentInsightsTranslate] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to translate Comment Insights analysis" },
      { status: 500 }
    );
  }
}
