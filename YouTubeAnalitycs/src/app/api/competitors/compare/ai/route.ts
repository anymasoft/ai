import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { db } from "@/lib/db";

interface CompetitorSummary {
  channelId: string;
  handle: string;
  title: string;
  avatarUrl?: string;
  subscribers: number;
  viewsTotal: number;
  videoCount: number;
  avgViewsPerVideo: number;
  lastSyncedAt: number;
}

interface CompareAnalysisResult {
  summary: string;
  leaders: string[];
  laggards: string[];
  strategies: string[];
  recommendations: string[];
}

/**
 * Создаёт OpenAI клиент с API ключом из переменных окружения
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in environment variables");
  }

  return new OpenAI({ apiKey });
}

/**
 * POST /api/competitors/compare/ai
 * Генерирует AI-анализ сравнения конкурентов
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { competitors } = body;

    if (!Array.isArray(competitors) || competitors.length === 0) {
      return NextResponse.json(
        { error: "Competitors array is required" },
        { status: 400 }
      );
    }

    console.log(`[CompareAI] Generating analysis for ${competitors.length} competitors`);

    const client = getOpenAIClient();

    // Формируем промпт на русском языке
    const prompt = `
Ты — аналитик YouTube-каналов и эксперт по росту каналов.

Я дам тебе список конкурирующих YouTube-каналов с их агрегированными метриками.
Твоя задача — сделать сравнительный анализ и выдать понятные, практичные выводы.

Формат входных данных (JSON):

${JSON.stringify({ competitors }, null, 2)}

Сделай следующее:

1. Определи лидеров по:
   - общему числу подписчиков,
   - общему числу просмотров,
   - средним просмотрам на видео.

2. Объясни, чем отличаются лидеры от остальных:
   - у кого "широкая база" (много подписчиков),
   - у кого "сильный контент" (высокие средние просмотры),
   - у кого "серый сегмент" (много видео, но слабые средние).

3. Дай краткий профиль каждого канала (1–2 предложения):
   - в чем его сила сейчас,
   - в чем слабость,
   - на что он, судя по метрикам, делает ставку.

4. Дай рекомендации пользователю:
   - на кого стоит равняться,
   - какую стратегию контента имеет смысл копировать,
   - кого можно игнорировать.

5. Пиши структурировано, списками, без воды.
6. Не пересказывай входные данные, фокусируйся на выводах.

Ответ верни в формате JSON:

{
  "summary": "краткий общий вывод (3–6 предложений)",
  "leaders": [
    "Текст по лидерам (кто и почему)"
  ],
  "laggards": [
    "Текст по отстающим"
  ],
  "strategies": [
    "Наблюдаемые стратегии контента лидеров"
  ],
  "recommendations": [
    "Практичные советы пользователю, что делать дальше"
  ]
}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт по YouTube аналитике. Анализируешь конкурентов и даёшь структурированные сравнительные выводы. Всегда отвечаешь валидным JSON на русском языке.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[CompareAI] Received response from OpenAI, parsing JSON...");

    const analysis: CompareAnalysisResult = JSON.parse(content);

    // Валидация структуры ответа
    if (
      !analysis.summary ||
      !Array.isArray(analysis.leaders) ||
      !Array.isArray(analysis.laggards) ||
      !Array.isArray(analysis.strategies) ||
      !Array.isArray(analysis.recommendations)
    ) {
      throw new Error("Invalid analysis structure from OpenAI");
    }

    console.log("[CompareAI] Analysis completed successfully");

    // Сохраняем анализ в базу данных
    try {
      const timestamp = Date.now();
      await db.execute({
        sql: `
          INSERT INTO comparative_analysis (userId, data, generatedAt)
          VALUES (?, ?, ?)
        `,
        args: [session.user.id, JSON.stringify(analysis), timestamp],
      });
      console.log("[CompareAI] Analysis saved to database");
    } catch (dbError) {
      console.error("[CompareAI] Failed to save analysis to database:", dbError);
      // Не прерываем выполнение, просто логируем ошибку
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[CompareAI] Error generating AI analysis:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to generate AI analysis" },
      { status: 500 }
    );
  }
}
