import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует возможности роста на основе комментариев
 * Возвращает: массив из 3+ объектов { opportunity, based_on, how_use, expected_effect }
 */

export interface GrowthOpportunity {
  opportunity: string;
  based_on: string;
  how_use: string;
  expected_effect: string;
}

function buildPrompt(
  comments: CommentForAnalysis[],
  language: "ru" | "en"
): string {
  const commentsSample = comments
    .slice(0, 50)
    .map((c) => `[${c.authorName}] (${c.likes} likes): ${c.content}`)
    .join("\n\n");

  if (language === "ru") {
    return `Ты - аналитик. Проанализируй комментарии и выведи 3 возможности роста канала.

Для каждой возможности верни JSON объект:
- opportunity: название возможности (5-10 слов)
- based_on: на основе чего это следует (1 предложение)
- how_use: как это использовать (1 предложение)
- expected_effect: ожидаемый результат (1 предложение)

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только JSON массив из 3 объектов, ничего больше.`;
  }

  return `You are an analyst. Analyze comments and identify 3 growth opportunities for the channel.

For each opportunity, return a JSON object:
- opportunity: opportunity name (5-10 words)
- based_on: based on what this follows (1 sentence)
- how_use: how to use it (1 sentence)
- expected_effect: expected result (1 sentence)

COMMENTS:
${commentsSample}

ANSWER: Only JSON array of 3 objects, nothing else.`;
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

function createEmptyOpportunities(
  language: "ru" | "en"
): GrowthOpportunity[] {
  return [
    {
      opportunity:
        language === "ru"
          ? "Развитие контента"
          : "Content development",
      based_on:
        language === "ru"
          ? "Анализ комментариев."
          : "Comment analysis.",
      how_use:
        language === "ru"
          ? "Применить предложения."
          : "Apply suggestions.",
      expected_effect:
        language === "ru"
          ? "Улучшение взаимодействия."
          : "Improved engagement.",
    },
  ];
}

export async function generateGrowthOpportunities(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<GrowthOpportunity[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[growthOpportunities] OPENAI_API_KEY not configured");
    return createEmptyOpportunities(language);
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
        max_tokens: 1000,
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

      const opportunities: GrowthOpportunity[] = parsed
        .slice(0, 10)
        .map((item: any) => ({
          opportunity: String(item.opportunity || "").slice(0, 100),
          based_on: String(item.based_on || "").slice(0, 200),
          how_use: String(item.how_use || "").slice(0, 200),
          expected_effect: String(item.expected_effect || "").slice(0, 200),
        }));

      if (opportunities.length === 0) {
        throw new Error("No opportunities extracted");
      }

      console.log(
        `[growthOpportunities] Generated ${opportunities.length} opportunities successfully`
      );
      return opportunities;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[growthOpportunities] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(
    "[growthOpportunities] All retry attempts failed:",
    lastError
  );
  return createEmptyOpportunities(language);
}
