import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует негативные триггеры - что раздражает аудиторию
 * Возвращает: массив из 3+ объектов { trigger, what_causes_negativity, why_harmful, fix, example }
 */

export interface NegativeTrigger {
  trigger: string;
  what_causes_negativity: string;
  why_harmful: string;
  fix: string;
  example: string;
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
    return `Ты - аналитик. Проанализируй комментарии и выведи 3 негативных триггера, которые раздражают или демотивируют аудиторию.

Для каждого триггера верни JSON объект:
- trigger: название триггера (5-10 слов)
- what_causes_negativity: что именно вызывает негатив (1 предложение)
- why_harmful: почему это вредит (1 предложение)
- fix: как это исправить (1 предложение)
- example: пример из комментариев (5-20 слов)

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только JSON массив из 3 объектов, ничего больше.`;
  }

  return `You are an analyst. Analyze comments and identify 3 negative triggers that annoy or demotivate the audience.

For each trigger, return a JSON object:
- trigger: trigger name (5-10 words)
- what_causes_negativity: what exactly causes negativity (1 sentence)
- why_harmful: why it's harmful (1 sentence)
- fix: how to fix it (1 sentence)
- example: example from comments (5-20 words)

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

function createEmptyNegativeTriggers(
  language: "ru" | "en"
): NegativeTrigger[] {
  return [
    {
      trigger:
        language === "ru" ? "Негативный триггер" : "Negative trigger",
      what_causes_negativity:
        language === "ru"
          ? "Недостаточно данных."
          : "Insufficient data.",
      why_harmful:
        language === "ru" ? "Неизвестно" : "Unknown",
      fix:
        language === "ru"
          ? "Требуется анализ."
          : "Analysis required.",
      example:
        language === "ru"
          ? "Требуется больше комментариев."
          : "More comments needed.",
    },
  ];
}

export async function generateNegativeTriggers(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<NegativeTrigger[]> {
  // Проверка на пустой массив комментариев
  if (!comments || comments.length === 0) {
    console.warn("[negative-triggers] No comments provided");
    return createEmptyNegativeTriggers(language);
  }
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[negativeTriggers] OPENAI_API_KEY not configured");
    return createEmptyNegativeTriggers(language);
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

      const triggers: NegativeTrigger[] = parsed
        .slice(0, 10)
        .map((item: any) => ({
          trigger: String(item.trigger || "").slice(0, 100),
          what_causes_negativity: String(
            item.what_causes_negativity || ""
          ).slice(0, 200),
          why_harmful: String(item.why_harmful || "").slice(0, 200),
          fix: String(item.fix || "").slice(0, 200),
          example: String(item.example || "").slice(0, 100),
        }));

      if (triggers.length === 0) {
        throw new Error("No triggers extracted");
      }

      console.log(
        `[negativeTriggers] Generated ${triggers.length} triggers successfully`
      );
      return triggers;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[negativeTriggers] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[negativeTriggers] All retry attempts failed:", lastError);
  return createEmptyNegativeTriggers(language);
}
