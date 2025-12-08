import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует поведенческие инсайты из комментариев
 * Возвращает: массив из 5+ строк (коротких предложений)
 */

function buildPrompt(
  comments: CommentForAnalysis[],
  language: "ru" | "en"
): string {
  const commentsSample = comments
    .slice(0, 50)
    .map((c) => `[${c.authorName}] (${c.likes} likes): ${c.content}`)
    .join("\n\n");

  if (language === "ru") {
    return `Ты - аналитик. Проанализируй комментарии и выведи 5 поведенческих инсайтов - реальных паттернов поведения аудитории.

Верни JSON массив из 5 коротких предложений (каждое 10-20 слов), описывающих типичное поведение, привычки, реакции аудитории.

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только JSON массив из 5 строк, ничего больше. Пример:
["Инсайт 1", "Инсайт 2", "Инсайт 3", "Инсайт 4", "Инсайт 5"]`;
  }

  return `You are an analyst. Analyze comments and identify 5 behavioral insights - real patterns of audience behavior.

Return JSON array of 5 short sentences (each 10-20 words) describing typical behavior, habits, reactions of the audience.

COMMENTS:
${commentsSample}

ANSWER: Only JSON array of 5 strings, nothing else. Example:
["Insight 1", "Insight 2", "Insight 3", "Insight 4", "Insight 5"]`;
}

function cleanLLMResponse(response: string): string {
  let cleaned = response.trim();

  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned;
}

function createEmptyInsights(language: "ru" | "en"): string[] {
  return [
    language === "ru"
      ? "Аудитория активно взаимодействует с контентом."
      : "The audience actively engages with content.",
  ];
}

export async function generateBehavioralInsights(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[behavioralInsights] OPENAI_API_KEY not configured");
    return createEmptyInsights(language);
  }

  const openai = new OpenAI({ apiKey });

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = buildPrompt(comments, language);

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI returned empty response");
      }

      const cleaned = cleanLLMResponse(content);
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }

      const insights: string[] = parsed
        .slice(0, 20)
        .map((item: any) => String(item).slice(0, 200));

      if (insights.length === 0) {
        throw new Error("No insights extracted");
      }

      console.log(
        `[behavioralInsights] Generated ${insights.length} insights successfully`
      );
      return insights;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[behavioralInsights] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(
    "[behavioralInsights] All retry attempts failed:",
    lastError
  );
  return createEmptyInsights(language);
}
