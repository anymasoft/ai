import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует эмоциональный обзор комментариев
 * Возвращает: строку из 2-3 предложений об эмоциональной атмосфере
 */

function buildPrompt(comments: CommentForAnalysis[], language: "ru" | "en"): string {
  const commentsSample = comments
    .slice(0, 50)
    .map((c) => `[${c.authorName}] (${c.likes} likes): ${c.content}`)
    .join("\n\n");

  if (language === "ru") {
    return `Ты - аналитик. Прочитай комментарии и опиши преобладающий эмоциональный тон в 2-3 коротких предложениях.

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только 2-3 предложения, описывающие общее эмоциональное состояние аудитории. Никакой структуры, никакого JSON, просто текст.`;
  }

  return `You are an analyst. Read the comments and describe the dominant emotional tone in 2-3 short sentences.

COMMENTS:
${commentsSample}

ANSWER: Only 2-3 sentences describing the overall emotional state of the audience. No structure, no JSON, just text.`;
}

function cleanLLMResponse(response: string): string {
  return response
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^[\*]+|[\*]+$/g, "")
    .replace(/^#+\s+/gm, "")
    .slice(0, 500);
}

export async function generateEmotionalOverview(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<string> {
  // Проверка на пустой массив комментариев
  if (!comments || comments.length === 0) {
    console.warn("[emotionalOverview] No comments provided");
    return language === "ru"
      ? "Нет комментариев для анализа."
      : "No comments to analyze.";
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[emotionalOverview] OPENAI_API_KEY not configured");
    return language === "ru"
      ? "Не удалось провести анализ."
      : "Unable to conduct analysis.";
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
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI returned empty response");
      }

      const cleaned = cleanLLMResponse(content);

      if (!cleaned || cleaned.length < 10) {
        throw new Error("Response too short after cleaning");
      }

      console.log("[emotionalOverview] Generated successfully");
      return cleaned;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[emotionalOverview] Attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[emotionalOverview] All retry attempts failed:", lastError);
  return language === "ru"
    ? "Не удалось провести анализ."
    : "Unable to conduct analysis.";
}
