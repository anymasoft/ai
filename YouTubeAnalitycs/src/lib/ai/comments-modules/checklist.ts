import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует чек-лист действий на основе анализа
 * Возвращает: ровно 8 строк в фиксированном порядке
 * 1. Убрать
 * 2. Добавить
 * 3. Усилить
 * 4. Изменить
 * 5. Частить
 * 6. Упростить
 * 7. Углубить
 * 8. Делать регулярно
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
    return `Ты - аналитик. На основе комментариев создай чек-лист из РОВНО 8 конкретных действий.

Порядок ФИКСИРОВАННЫЙ:
1. Убрать - что удалить из контента
2. Добавить - что добавить в контент
3. Усилить - что интенсифицировать
4. Изменить - что изменить подход
5. Частить - что делать чаще
6. Упростить - что упростить
7. Углубить - что углубить
8. Делать регулярно - что делать каждый раз

Каждый пункт - одна фраза (5-15 слов).

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Отправь ТОЛЬКО JSON массив из ровно 8 строк. Без текста, без объяснений. Порядок элементов КРИТИЧЕСКИ ВАЖЕН.
Пример:
["Убрать: переходы", "Добавить: примеры", "Усилить: посыл", "Изменить: структуру", "Частить: видео", "Упростить: язык", "Углубить: анализ", "Делать: еженедельно"]`;
  }

  return `You are an analyst. Based on comments, create a checklist of EXACTLY 8 specific actions.

The order is FIXED:
1. Remove - what to delete from content
2. Add - what to add to content
3. Amplify - what to intensify
4. Change - what approach to change
5. Increase frequency - what to do more often
6. Simplify - what to simplify
7. Deepen - what to go deeper on
8. Do regularly - what to do every time

Each item is one phrase (5-15 words).

COMMENTS:
${commentsSample}

ANSWER: Send ONLY JSON array of exactly 8 strings. No text, no explanations. Order of elements is CRITICAL.
Example:
["Remove: transitions", "Add: examples", "Amplify: message", "Change: structure", "Increase: videos", "Simplify: language", "Deepen: analysis", "Do: weekly"]`;
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

function createEmptyChecklist(language: "ru" | "en"): string[] {
  if (language === "ru") {
    return [
      "Убрать: водяные знаки",
      "Добавить: примеры",
      "Усилить: основной посыл",
      "Изменить: структуру",
      "Частить: выпуски",
      "Упростить: язык",
      "Углубить: анализ",
      "Делать: еженедельно",
    ];
  }

  return [
    "Remove: watermarks",
    "Add: examples",
    "Amplify: main message",
    "Change: structure",
    "Increase: uploads",
    "Simplify: language",
    "Deepen: analysis",
    "Do: weekly",
  ];
}

export async function generateChecklist(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<string[]> {
  // Проверка на пустой массив комментариев
  if (!comments || comments.length === 0) {
    console.warn("[checklist] No comments provided");
    return createEmptyChecklist(language);
  }
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[checklist] OPENAI_API_KEY not configured");
    return createEmptyChecklist(language);
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

      let checklist: string[] = parsed.map((item: any) =>
        String(item).slice(0, 150)
      );

      // Гарантируем ровно 8 элементов
      while (checklist.length < 8) {
        checklist.push(
          language === "ru"
            ? `Элемент ${checklist.length + 1}`
            : `Item ${checklist.length + 1}`
        );
      }

      checklist = checklist.slice(0, 8);

      console.log("[checklist] Generated checklist with 8 items successfully");
      return checklist;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[checklist] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[checklist] All retry attempts failed:", lastError);
  return createEmptyChecklist(language);
}
