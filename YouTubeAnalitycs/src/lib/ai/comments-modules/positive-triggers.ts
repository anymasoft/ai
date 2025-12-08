import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует позитивные триггеры - что нравится аудитории
 * Возвращает: массив из 3+ объектов { trigger, what_praised, why_resonates, video_types }
 */

export interface PositiveTrigger {
  trigger: string;
  what_praised: string;
  why_resonates: string;
  video_types: string;
}

function buildPrompt(
  comments: CommentForAnalysis[],
  language: "ru" | "en"
): string {
  const topComments = comments
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 50)
    .map((c) => `[${c.authorName}] (${c.likes} likes): ${c.content}`)
    .join("\n\n");

  if (language === "ru") {
    return `Ты - аналитик. Проанализируй позитивные комментарии и выведи 3 триггера, которые вызывают положительные реакции.

Для каждого триггера верни JSON объект:
- trigger: название триггера (5-10 слов)
- what_praised: что конкретно хвалят (1 предложение)
- why_resonates: почему это резонирует (1 предложение)
- video_types: какие типы видео это вызывают (1 предложение)

КОММЕНТАРИИ:
${topComments}

ОТВЕТ: Только JSON массив из 3 объектов, ничего больше.`;
  }

  return `You are an analyst. Analyze positive comments and identify 3 triggers that cause positive reactions.

For each trigger, return a JSON object:
- trigger: trigger name (5-10 words)
- what_praised: what exactly is praised (1 sentence)
- why_resonates: why it resonates (1 sentence)
- video_types: what video types trigger this (1 sentence)

COMMENTS:
${topComments}

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

function createEmptyPositiveTriggers(language: "ru" | "en"): PositiveTrigger[] {
  return [
    {
      trigger:
        language === "ru" ? "Позитивный триггер" : "Positive trigger",
      what_praised:
        language === "ru"
          ? "Недостаточно данных."
          : "Insufficient data.",
      why_resonates:
        language === "ru" ? "Неизвестно" : "Unknown",
      video_types:
        language === "ru"
          ? "Требуется больше комментариев."
          : "More comments needed.",
    },
  ];
}

export async function generatePositiveTriggers(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<PositiveTrigger[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[positiveTriggers] OPENAI_API_KEY not configured");
    return createEmptyPositiveTriggers(language);
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

      const triggers: PositiveTrigger[] = parsed
        .slice(0, 10)
        .map((item: any) => ({
          trigger: String(item.trigger || "").slice(0, 100),
          what_praised: String(item.what_praised || "").slice(0, 200),
          why_resonates: String(item.why_resonates || "").slice(0, 200),
          video_types: String(item.video_types || "").slice(0, 200),
        }));

      if (triggers.length === 0) {
        throw new Error("No triggers extracted");
      }

      console.log(
        `[positiveTriggers] Generated ${triggers.length} triggers successfully`
      );
      return triggers;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[positiveTriggers] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[positiveTriggers] All retry attempts failed:", lastError);
  return createEmptyPositiveTriggers(language);
}
