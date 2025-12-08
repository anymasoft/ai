import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует ключевые темы из комментариев
 * Возвращает: массив из 3+ объектов { name, description, examples[], motive, usage }
 */

export interface KeyTopic {
  name: string;
  description: string;
  examples: string[];
  motive: string;
  usage: string;
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
    return `Ты - аналитик. Проанализируй комментарии и выведи 3 самых ключевых темы, о которых говорят зрители.

Для каждой темы верни JSON объект с полями:
- name: название темы (5-10 слов)
- description: описание (1 предложение)
- examples: массив из 3 примеров (каждый 3-5 слов)
- motive: что их мотивирует (1 фраза 5-10 слов)
- usage: как использовать эту информацию (1 предложение)

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Отправь ТОЛЬКО JSON массив из 3 объектов. Без текста, без markdown, без объяснений. JSON начинается с [ и заканчивается с ]. НИЧЕГО больше.

Пример формата:
[
  {
    "name": "Название темы",
    "description": "Описание",
    "examples": ["пример1", "пример2", "пример3"],
    "motive": "Что их мотивирует",
    "usage": "Использование"
  },
  ...
]`;
  }

  return `You are an analyst. Analyze the comments and identify 3 key topics that viewers discuss.

For each topic, return a JSON object with fields:
- name: topic name (5-10 words)
- description: description (1 sentence)
- examples: array of 3 examples (each 3-5 words)
- motive: what motivates them (1 phrase 5-10 words)
- usage: how to use this information (1 sentence)

COMMENTS:
${commentsSample}

ANSWER: Send ONLY JSON array of 3 objects. No text, no markdown, no explanations. JSON starts with [ and ends with ]. NOTHING else.

Example format:
[
  {
    "name": "Topic name",
    "description": "Description",
    "examples": ["example1", "example2", "example3"],
    "motive": "What motivates them",
    "usage": "Usage"
  },
  ...
]`;
}

function cleanLLMResponse(response: string): string {
  let cleaned = response.trim();

  // Вытаскиваем JSON массив
  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned;
}

function createEmptyKeyTopics(language: "ru" | "en"): KeyTopic[] {
  return [
    {
      name: language === "ru" ? "Тема не определена" : "Topic not determined",
      description:
        language === "ru"
          ? "Недостаточно данных для анализа."
          : "Insufficient data for analysis.",
      examples: ["", "", ""],
      motive: language === "ru" ? "Неизвестна" : "Unknown",
      usage:
        language === "ru"
          ? "Требуется больше комментариев."
          : "More comments needed.",
    },
  ];
}

export async function generateKeyTopics(
  comments: CommentForAnalysis[],
  lang: "ru" | "en" = "en"
): Promise<KeyTopic[]> {
  // Проверка на пустой массив комментариев
  if (!comments || comments.length === 0) {
    console.warn("[keyTopics] No comments provided");
    return createEmptyKeyTopics(lang);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[keyTopics] OPENAI_API_KEY not configured");
    return createEmptyKeyTopics(lang);
  }

  const openai = new OpenAI({ apiKey });

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = buildPrompt(comments, lang);

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

      // Валидируем и заполняем пропущенные поля
      const topics: KeyTopic[] = parsed
        .slice(0, 10)
        .map((item: any) => ({
          name: String(item.name || "").slice(0, 100),
          description: String(item.description || "").slice(0, 200),
          examples: Array.isArray(item.examples)
            ? item.examples.slice(0, 3).map((e: any) => String(e).slice(0, 50))
            : ["", "", ""],
          motive: String(item.motive || "").slice(0, 100),
          usage: String(item.usage || "").slice(0, 200),
        }));

      if (topics.length === 0) {
        throw new Error("No topics extracted");
      }

      console.log(`[keyTopics] Generated ${topics.length} topics successfully`);
      return topics;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[keyTopics] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[keyTopics] All retry attempts failed:", lastError);
  return createEmptyKeyTopics(lang);
}
