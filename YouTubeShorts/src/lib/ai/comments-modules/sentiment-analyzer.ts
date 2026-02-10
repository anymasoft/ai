import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Помощник для безопасного парсинга числа из LLM ответа
 * LLM может вернуть число обёрнутое в текст, пробелы и т.д.
 */
function extractNumberFromResponse(response: string): number {
  const cleaned = response.trim();
  const match = cleaned.match(/\d+/);
  const parsed = match ? parseInt(match[0], 10) : 0;
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Получает массив текстов комментариев для отправки в промпт
 */
function buildCommentsText(comments: CommentForAnalysis[]): string {
  return comments.map((c, idx) => `${idx + 1}. ${c.content}`).join("\n");
}

/**
 * Вспомогательная функция для выполнения retry логики
 */
async function performRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  label: string = "Operation"
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[${label}] Попытка ${attempt}/${maxAttempts} не удалась:`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
      // Небольшая задержка перед повтором
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`[${label}] Все ${maxAttempts} попытки исчерпаны`);
}

/**
 * Подсчитывает количество позитивных комментариев
 */
export async function countPositive(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<number> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt =
    language === "ru"
      ? "Ты — эксперт по анализу тональности комментариев YouTube. Твоя задача — подсчитать количество комментариев с ясно выраженным позитивным настроением."
      : "You are an AI sentiment classifier. Your task is to count positive comments in a list.";

  const userPrompt =
    language === "ru"
      ? `Проанализируй список комментариев YouTube. Подсчитай количество комментариев с ПОЗИТИВНЫМ настроением.

Позитивное = поддерживающее, оптимистичное, одобрительное, благодарное, впечатлённое, восторженное.

Список комментариев:
${buildCommentsText(comments)}

Верни ТОЛЬКО число. Ничего больше.`
      : `Analyze this list of YouTube comments and count how many express clearly positive sentiment.

Positive = supportive, optimistic, approving, thankful, impressed, excited.

Comments:
${buildCommentsText(comments)}

Return ONLY one integer. No words, no explanation.`;

  return performRetry(
    async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content || "0";
      const count = extractNumberFromResponse(responseText);
      console.log(`[countPositive] Получен результат: ${count}`);
      return count;
    },
    3,
    "countPositive"
  );
}

/**
 * Подсчитывает количество нейтральных комментариев
 */
export async function countNeutral(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<number> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt =
    language === "ru"
      ? "Ты — эксперт по анализу тональности комментариев YouTube. Твоя задача — подсчитать количество комментариев с нейтральным настроением."
      : "You are an AI sentiment classifier. Your task is to count neutral comments in a list.";

  const userPrompt =
    language === "ru"
      ? `Проанализируй список комментариев YouTube. Подсчитай количество комментариев с НЕЙТРАЛЬНЫМ настроением.

Нейтральное = описательное, фактическое, информационное, не связанное с эмоциональной полярностью, шутливое без явной эмоциональной окраски.

Список комментариев:
${buildCommentsText(comments)}

Верни ТОЛЬКО число. Ничего больше.`
      : `Analyze this list of YouTube comments and count how many are neutral.

Neutral = descriptive, factual, informative, unrelated, joking without emotional polarity.

Comments:
${buildCommentsText(comments)}

Return ONLY one integer. No words, no explanation.`;

  return performRetry(
    async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content || "0";
      const count = extractNumberFromResponse(responseText);
      console.log(`[countNeutral] Получен результат: ${count}`);
      return count;
    },
    3,
    "countNeutral"
  );
}

/**
 * Подсчитывает количество негативных комментариев
 */
export async function countNegative(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<number> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt =
    language === "ru"
      ? "Ты — эксперт по анализу тональности комментариев YouTube. Твоя задача — подсчитать количество комментариев с ясно выраженным негативным настроением."
      : "You are an AI sentiment classifier. Your task is to count negative comments in a list.";

  const userPrompt =
    language === "ru"
      ? `Проанализируй список комментариев YouTube. Подсчитай количество комментариев с НЕГАТИВНЫМ настроением.

Негативное = критика, разочарование, недовольство, гнев, страх, негативность.

Список комментариев:
${buildCommentsText(comments)}

Верни ТОЛЬКО число. Ничего больше.`
      : `Analyze this list of YouTube comments and count how many express negative sentiment.

Negative = criticism, frustration, disappointment, anger, fear, negativity.

Comments:
${buildCommentsText(comments)}

Return ONLY one integer. No words, no explanation.`;

  return performRetry(
    async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content || "0";
      const count = extractNumberFromResponse(responseText);
      console.log(`[countNegative] Получен результат: ${count}`);
      return count;
    },
    3,
    "countNegative"
  );
}
