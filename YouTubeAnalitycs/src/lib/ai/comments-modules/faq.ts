import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует FAQ на основе комментариев
 * Возвращает: массив из 3+ объектов { question, why_appears, action }
 */

export interface FAQ {
  question: string;
  why_appears: string;
  action: string;
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
    return `Ты - аналитик. Проанализируй комментарии и выведи 3 часто задаваемых вопроса, которые беспокоят аудиторию.

Для каждого вопроса верни JSON объект:
- question: сам вопрос (5-15 слов)
- why_appears: почему люди его задают (1 предложение)
- action: как на него ответить (1-2 предложения)

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только JSON массив из 3 объектов, ничего больше.`;
  }

  return `You are an analyst. Analyze comments and identify 3 frequently asked questions that concern the audience.

For each question, return a JSON object:
- question: the question itself (5-15 words)
- why_appears: why people ask it (1 sentence)
- action: how to answer it (1-2 sentences)

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

function createEmptyFAQ(language: "ru" | "en"): FAQ[] {
  return [
    {
      question:
        language === "ru"
          ? "Как улучшить контент?"
          : "How to improve content?",
      why_appears:
        language === "ru"
          ? "Это общий вопрос."
          : "This is a common question.",
      action:
        language === "ru"
          ? "Требуется больше данных."
          : "More data required.",
    },
  ];
}

export async function generateFAQ(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<FAQ[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[FAQ] OPENAI_API_KEY not configured");
    return createEmptyFAQ(language);
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

      const faqs: FAQ[] = parsed
        .slice(0, 10)
        .map((item: any) => ({
          question: String(item.question || "").slice(0, 150),
          why_appears: String(item.why_appears || "").slice(0, 200),
          action: String(item.action || "").slice(0, 300),
        }));

      if (faqs.length === 0) {
        throw new Error("No FAQs extracted");
      }

      console.log(
        `[FAQ] Generated ${faqs.length} questions successfully`
      );
      return faqs;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[FAQ] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[FAQ] All retry attempts failed:", lastError);
  return createEmptyFAQ(language);
}
