import OpenAI from "openai";
import { CommentForAnalysis } from "../comments-analysis";

/**
 * Генерирует сегменты аудитории
 * Возвращает: массив из 3+ объектов { segment, description, writes_about, understanding_level, motives, suitable_content, growth_strategy }
 */

export interface AudienceSegment {
  segment: string;
  description: string;
  writes_about: string;
  understanding_level: string;
  motives: string;
  suitable_content: string;
  growth_strategy: string;
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
    return `Ты - аналитик. Разбей аудиторию на 3 основных сегмента на основе комментариев.

Для каждого сегмента верни JSON объект:
- segment: название сегмента (5-10 слов)
- description: кто это (1 предложение)
- writes_about: о чём пишут (1 предложение)
- understanding_level: уровень понимания (1 предложение)
- motives: их мотивация (1 предложение)
- suitable_content: какой контент им нравится (1 предложение)
- growth_strategy: как их удержать (1 предложение)

КОММЕНТАРИИ:
${commentsSample}

ОТВЕТ: Только JSON массив из 3 объектов, ничего больше.`;
  }

  return `You are an analyst. Segment the audience into 3 main segments based on comments.

For each segment, return a JSON object:
- segment: segment name (5-10 words)
- description: who they are (1 sentence)
- writes_about: what they write about (1 sentence)
- understanding_level: their understanding level (1 sentence)
- motives: their motivation (1 sentence)
- suitable_content: content they like (1 sentence)
- growth_strategy: how to retain them (1 sentence)

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

function createEmptySegments(
  language: "ru" | "en"
): AudienceSegment[] {
  return [
    {
      segment:
        language === "ru" ? "Сегмент 1" : "Segment 1",
      description:
        language === "ru"
          ? "Основной сегмент."
          : "Main segment.",
      writes_about:
        language === "ru"
          ? "Общее содержание."
          : "General content.",
      understanding_level:
        language === "ru"
          ? "Средний уровень."
          : "Average level.",
      motives:
        language === "ru"
          ? "Интерес к контенту."
          : "Content interest.",
      suitable_content:
        language === "ru"
          ? "Разнообразный контент."
          : "Diverse content.",
      growth_strategy:
        language === "ru"
          ? "Требуется больше данных."
          : "More data required.",
    },
  ];
}

export async function generateAudienceSegments(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<AudienceSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[audienceSegments] OPENAI_API_KEY not configured");
    return createEmptySegments(language);
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
        max_tokens: 1500,
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

      const segments: AudienceSegment[] = parsed
        .slice(0, 10)
        .map((item: any) => ({
          segment: String(item.segment || "").slice(0, 100),
          description: String(item.description || "").slice(0, 200),
          writes_about: String(item.writes_about || "").slice(0, 200),
          understanding_level: String(
            item.understanding_level || ""
          ).slice(0, 200),
          motives: String(item.motives || "").slice(0, 200),
          suitable_content: String(item.suitable_content || "").slice(
            0,
            200
          ),
          growth_strategy: String(item.growth_strategy || "").slice(0, 200),
        }));

      if (segments.length === 0) {
        throw new Error("No segments extracted");
      }

      console.log(
        `[audienceSegments] Generated ${segments.length} segments successfully`
      );
      return segments;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[audienceSegments] Attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[audienceSegments] All retry attempts failed:", lastError);
  return createEmptySegments(language);
}
