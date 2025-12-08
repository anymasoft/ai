import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует список отсутствующих элементов
 * Возвращает: массив из 3+ строк (то, чего не хватает аудитории)
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
    return `Ты - аналитик. Проанализируй комментарии и выведи 3 элемента, которых не хватает аудитории или контенту.

Верни JSON массив из 3 коротких предложений (каждое 10-20 слов), описывающих пробелы в контенте, функциях, информации.

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только JSON массив из 3 строк, ничего больше. Пример:
["Не хватает элемента 1", "Не хватает элемента 2", "Не хватает элемента 3"]`;
  }

  return `You are an analyst. Analyze comments and identify 3 elements that the audience or content is missing.

Return JSON array of 3 short sentences (each 10-20 words) describing gaps in content, features, information.

COMMENTS:
${commentsSample}

ANSWER: Only JSON array of 3 strings, nothing else. Example:
["Missing element 1", "Missing element 2", "Missing element 3"]`;
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

function createEmptyElements(language: "ru" | "en"): string[] {
  return [
    language === "ru"
      ? "Требуется дополнительная информация."
      : "Additional information is needed.",
  ];
}

export async function generateMissingElements(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<string[]> {
  // Проверка на пустой массив комментариев
  if (!comments || comments.length === 0) {
    console.warn("[missing-elements] No comments provided");
    return createEmptyElements(language);
  }
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[missingElements] OPENAI_API_KEY not configured");
    return createEmptyElements(language);
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
        max_tokens: 600,
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

      const elements: string[] = parsed
        .slice(0, 10)
        .map((item: any) => String(item).slice(0, 200));

      if (elements.length === 0) {
        throw new Error("No elements extracted");
      }

      console.log(
        `[missingElements] Generated ${elements.length} elements successfully`
      );
      return elements;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[missingElements] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(
    "[missingElements] All retry attempts failed:",
    lastError
  );
  return createEmptyElements(language);
}
