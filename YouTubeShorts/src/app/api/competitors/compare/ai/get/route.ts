import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface CompareAnalysisResult {
  summary: string;
  leaders: string[];
  laggards: string[];
  strategies: string[];
  recommendations: string[];
}

/**
 * GET /api/competitors/compare/ai
 * Получает последний сохранённый AI-анализ сравнения конкурентов
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[CompareAI] Fetching latest analysis for user ${session.user.id}`);

    // Получаем последний анализ пользователя
    const result = await db.execute({
      sql: `
        SELECT data, generatedAt
        FROM comparative_analysis
        WHERE userId = ?
        ORDER BY generatedAt DESC
        LIMIT 1
      `,
      args: [session.user.id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        analysis: null,
        message: "No analysis found"
      });
    }

    const row = result.rows[0];
    const analysis: CompareAnalysisResult = JSON.parse(row.data as string);
    const generatedAt = row.generatedAt as number;

    console.log("[CompareAI] Found analysis from", new Date(generatedAt).toISOString());

    return NextResponse.json({
      analysis,
      generatedAt,
    });
  } catch (error) {
    console.error("[CompareAI] Error fetching analysis:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}
