import OpenAI from "openai";
import { createClient } from "@libsql/client";

/**
 * Helper для обновления прогресса анализа в БД
 * Использует двухшаговый подход, т.к. SQLite не поддерживает ORDER BY в UPDATE
 */
async function updateProgress(
  channelId: string,
  current: number,
  total: number,
  status: 'pending' | 'processing' | 'done' | 'error'
) {
  try {
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Шаг 1: Найти id последней записи для этого канала
    const result = await client.execute({
      sql: `SELECT id FROM channel_ai_comment_insights
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    if (result.rows.length === 0) {
      console.error('[updateProgress] No record found for channelId:', channelId);
      client.close();
      return;
    }

    const recordId = result.rows[0].id;

    // Шаг 2: Обновить запись по id
    await client.execute({
      sql: `UPDATE channel_ai_comment_insights
            SET progress_current = ?, progress_total = ?, status = ?
            WHERE id = ?`,
      args: [current, total, status, recordId],
    });

    console.log(`[updateProgress] Updated record ${recordId}: ${current}/${total} (${status})`);

    client.close();
  } catch (error) {
    console.error('[updateProgress] Error:', error);
  }
}

/**
 * Типы для результатов глубокого анализа комментариев
 */

export interface DeepAnalysisResult {
  themes: string[];
  pain_points: string[];
  requests: string[];
  praises: string[];
  segments: string[];
  sentiment_summary: {
    positive: number;
    negative: number;
    neutral: number;
  };
  quotes: string[];
  hidden_patterns: string[];
  ideas: string[];
}

export interface CombinedDeepAnalysis {
  themes: string[];
  painPoints: string[];
  requests: string[];
  praises: string[];
  audienceSegments: string[];
  sentimentSummary: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topQuotes: string[];
  hiddenPatterns: string[];
  actionableIdeas: string[];
  totalAnalyzed: number;
  language: string;
}

/**
 * Интерфейс для комментария
 */
export interface CommentForAnalysis {
  content: string;
  likes: number;
  authorName: string;
}

/**
 * Нормализует текст комментариев для анализа
 * - Удаляет emoji
 * - Удаляет URL
 * - Удаляет хештеги
 * - Удаляет HTML
 * - Нормализует пробелы
 */
export function normalizeCommentText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let normalized = text;

  // Удаляем emoji используя Unicode диапазоны
  normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}-\u{1F0CF}]|[\u{1F170}-\u{1F251}]/gu, '');

  // Удаляем URLs
  normalized = normalized.replace(/https?:\/\/[^\s]+/gi, '');
  normalized = normalized.replace(/www\.[^\s]+/gi, '');
  normalized = normalized.replace(/(?:youtube\.com|youtu\.be)\/[^\s]*/gi, '');

  // Удаляем хештеги
  normalized = normalized.replace(/#\w+/g, '');

  // Удаляем HTML теги
  normalized = normalized.replace(/<[^>]*>/g, '');

  // Удаляем timestamp метки (например: 00:12, 1:23:45)
  normalized = normalized.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');

  // Нормализуем пробелы
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.trim();

  return normalized;
}

/**
 * Нормализует массив комментариев
 */
export function normalizeComments(comments: CommentForAnalysis[]): CommentForAnalysis[] {
  return comments
    .map((comment) => ({
      ...comment,
      content: normalizeCommentText(comment.content),
    }))
    .filter((comment) => comment.content.length >= 5); // Минимум 5 символов
}

/**
 * Разбивает комментарии на чанки для отправки в GPT
 * Ограничение: ~3500-4000 символов на чанк
 */
export function chunkComments(
  comments: CommentForAnalysis[],
  maxChunkSize: number = 3500
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const comment of comments) {
    const commentText = `[${comment.authorName}] (${comment.likes} likes): ${comment.content}`;
    const commentSize = commentText.length;

    // Если один комментарий больше maxChunkSize, добавляем его отдельно (обрезаем)
    if (commentSize > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [];
        currentSize = 0;
      }
      chunks.push(commentText.slice(0, maxChunkSize));
      continue;
    }

    // Если добавление комментария превысит лимит, создаём новый чанк
    if (currentSize + commentSize + 2 > maxChunkSize) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [commentText];
      currentSize = commentSize;
    } else {
      currentChunk.push(commentText);
      currentSize += commentSize + 2; // +2 для \n\n
    }
  }

  // Добавляем последний чанк
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}

/**
 * Премиальный промпт для глубокого анализа комментариев
 */
const DEEP_COMMENTS_PROMPT_RU = `Ты - высокопрофессиональный аналитик поведения аудитории YouTube. Твоя задача - провести полный и глубокий анализ комментариев.

ВХОДНЫЕ ДАННЫЕ: Массив комментариев (текст, автор, лайки).

ТВОЯ ЗАДАЧА: Вернуть JSON анализ СТРОГО в следующей структуре:

{
  "emotionalOverview": "описание преобладающего тона и эмоций (максимум 250 символов, 2-3 предложения)",
  "keyTopics": [минимум 3 объекта с полями: name (5-10 слов), description (1 предложение), examples (массив 3 строк по 3-5 слов), motive (1 фраза 5-10 слов), usage (1 предложение)],
  "positiveTriggers": [минимум 3 объекта с полями: trigger (5-10 слов), what_praised (1 предложение), why_resonates (1 предложение), video_types (1 предложение)],
  "negativeTriggers": [минимум 3 объекта с полями: trigger (5-10 слов), what_causes_negativity (1 предложение), why_harmful (1 предложение), fix (1 предложение), example (1 фраза)],
  "faq": [минимум 3 объекта с полями: question (1 вопрос 5-15 слов), why_appears (1 предложение), action (1 предложение)],
  "audienceSegments": [минимум 3 объекта с полями: segment (5-10 слов), description (1 предложение), writes_about (1 предложение), understanding_level (1 предложение), motives (1 фраза 5-10 слов), suitable_content (1 предложение), growth_strategy (1 предложение)],
  "behavioralInsights": [минимум 5 строк, каждая 1 предложение 10-20 слов],
  "missingElements": [минимум 3 строки, каждая 1 предложение 10-20 слов],
  "growthOpportunities": [минимум 3 объекта с полями: opportunity (5-10 слов), based_on (1 предложение), how_use (1 предложение), expected_effect (1 предложение)],
  "checklist": [ровно 8 строк для действий: Убрать, Добавить, Усилить, Изменить, Частить, Упростить, Углубить, Делать регулярно]
}

ЖЁСТКИЕ ТРЕБОВАНИЯ:
1. ВСЕ 10 ПОЛЕЙ ОБЯЗАТЕЛЬНЫ. Ни одного нельзя пропускать.
2. КАЖДЫЙ массив должен содержать минимум элементов указанное количество. Если данных мало - заполни пустыми strings или пустыми объектами но НЕ удаляй поле.
3. ОТВЕТ ДОЛЖЕН БЫТЬ ВАЛИДНЫЙ JSON. Проверь скобки, запятые, кавычки.
4. НИКАКИХ пояснений, НИКАКИХ текста до и после JSON. Только JSON от { до }.
5. Если комментариев мало - все равно заполни ВСЕ поля минимальным контентом.
6. Ответ начинается с { и заканчивается с } и больше ничем.
7. Все текстовые значения на русском языке.
8. Работай ТОЛЬКО с реальными данными из комментариев. Никаких выдумок.
9. Все текстовые значения должны быть максимально краткими: каждое поле 1-2 предложения максимум. Длинные описания запрещены.`;

const DEEP_COMMENTS_PROMPT_EN = `You are a highly professional YouTube audience behavior analyst. Your task is to conduct a complete and deep analysis of comments.

INPUT DATA: Array of comments (text, author, likes).

YOUR TASK: Return JSON analysis STRICTLY in the following structure:

{
  "emotionalOverview": "description of dominant tone and emotions (max 250 chars, 2-3 sentences)",
  "keyTopics": [minimum 3 objects with fields: name (5-10 words), description (1 sentence), examples (array 3 strings of 3-5 words each), motive (1 phrase 5-10 words), usage (1 sentence)],
  "positiveTriggers": [minimum 3 objects with fields: trigger (5-10 words), what_praised (1 sentence), why_resonates (1 sentence), video_types (1 sentence)],
  "negativeTriggers": [minimum 3 objects with fields: trigger (5-10 words), what_causes_negativity (1 sentence), why_harmful (1 sentence), fix (1 sentence), example (1 phrase)],
  "faq": [minimum 3 objects with fields: question (1 question 5-15 words), why_appears (1 sentence), action (1 sentence)],
  "audienceSegments": [minimum 3 objects with fields: segment (5-10 words), description (1 sentence), writes_about (1 sentence), understanding_level (1 sentence), motives (1 phrase 5-10 words), suitable_content (1 sentence), growth_strategy (1 sentence)],
  "behavioralInsights": [minimum 5 strings, each 1 sentence 10-20 words],
  "missingElements": [minimum 3 strings, each 1 sentence 10-20 words],
  "growthOpportunities": [minimum 3 objects with fields: opportunity (5-10 words), based_on (1 sentence), how_use (1 sentence), expected_effect (1 sentence)],
  "checklist": [exactly 8 strings for actions: Remove, Add, Amplify, Change, Increase, Simplify, Deepen, Do]
}

STRICT REQUIREMENTS:
1. ALL 10 FIELDS ARE MANDATORY. Do not skip any field.
2. EACH array must contain minimum number of elements. If data is sparse - fill with empty strings or empty objects but DO NOT remove the field.
3. ANSWER MUST BE VALID JSON. Check brackets, commas, quotes.
4. NO explanations, NO text before and after JSON. Only JSON from opening brace to closing brace.
5. If few comments - still fill ALL fields with minimum content.
6. Answer starts with { and ends with } and nothing more.
7. All text values in English.
8. Work ONLY with real data from comments. No hallucinations.
9. All text values must be concise: each field max 1-2 sentences. Long descriptions are forbidden.`;

/**
 * Безопасно извлекает JSON-объект из строки
 * Ищет первую { и последнюю } и берёт текст между ними
 * Нужно потому что LLM иногда добавляет пояснения вокруг JSON
 */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return raw.slice(start, end + 1);
}

/**
 * Безопасно парсит JSON с fallback на пустую структуру
 */
function safeParseJson(content: string, language: string = "en"): DeepAnalysisResult {
  try {
    // 1. Попытаемся парсить как есть
    const analysis = JSON.parse(content);
    return analysis;
  } catch (firstError) {
    console.warn("[DeepAnalysis] Failed to parse JSON directly, attempting to extract JSON object...", firstError);

    // 2. Попробуем вытащить JSON объект из текста
    const jsonCandidate = extractJsonObject(content);

    if (!jsonCandidate) {
      console.error("[DeepAnalysis] Could not extract JSON object from response. First 500 chars:", content.slice(0, 500));
      // Возвращаем пустую структуру вместо ошибки
      return createEmptyAnalysisResult();
    }

    try {
      const analysis = JSON.parse(jsonCandidate);
      console.log("[DeepAnalysis] Successfully extracted and parsed JSON object");
      return analysis;
    } catch (secondError) {
      console.error("[DeepAnalysis] Failed to parse extracted JSON object:", secondError, "Content:", jsonCandidate.slice(0, 500));
      // Возвращаем пустую структуру вместо ошибки
      return createEmptyAnalysisResult();
    }
  }
}

/**
 * Создаёт пустую структуру анализа с безопасными значениями
 */
function createEmptyAnalysisResult(): DeepAnalysisResult {
  return {
    themes: [],
    pain_points: [],
    requests: [],
    praises: [],
    segments: [],
    sentiment_summary: {
      positive: 0,
      negative: 0,
      neutral: 0,
    },
    quotes: [],
    hidden_patterns: [],
    ideas: [],
  };
}

/**
 * Генерирует глубокий анализ одного чанка комментариев через GPT-4.1-mini
 */
export async function generateDeepAnalysis(
  chunk: string,
  language: string = "en"
): Promise<DeepAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in environment variables");
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = language === "ru" ? DEEP_COMMENTS_PROMPT_RU : DEEP_COMMENTS_PROMPT_EN;

  console.log(`[DeepAnalysis] Generating analysis for chunk (${chunk.length} chars, language: ${language})`);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `CONTENT (COMMENTS):\n${chunk}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 6000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[DeepAnalysis] Successfully received response from OpenAI");

    // Безопасный парсинг JSON с fallback на пустую структуру
    const analysis: DeepAnalysisResult = safeParseJson(content, language);

    console.log("[DeepAnalysis] JSON parsed successfully (or fallback applied)");

    // Двойная валидация структуры с fallback значениями
    const validatedAnalysis: DeepAnalysisResult = {
      themes: Array.isArray(analysis.themes) ? analysis.themes : [],
      pain_points: Array.isArray(analysis.pain_points) ? analysis.pain_points : [],
      requests: Array.isArray(analysis.requests) ? analysis.requests : [],
      praises: Array.isArray(analysis.praises) ? analysis.praises : [],
      segments: Array.isArray(analysis.segments) ? analysis.segments : [],
      sentiment_summary: analysis.sentiment_summary &&
        typeof analysis.sentiment_summary === 'object' &&
        'positive' in analysis.sentiment_summary &&
        'negative' in analysis.sentiment_summary &&
        'neutral' in analysis.sentiment_summary
        ? analysis.sentiment_summary
        : { positive: 0, negative: 0, neutral: 0 },
      quotes: Array.isArray(analysis.quotes) ? analysis.quotes : [],
      hidden_patterns: Array.isArray(analysis.hidden_patterns) ? analysis.hidden_patterns : [],
      ideas: Array.isArray(analysis.ideas) ? analysis.ideas : [],
    };

    // Логируем если были заполнены fallback значения
    const hasDefaults =
      !Array.isArray(analysis.themes) ||
      !Array.isArray(analysis.pain_points) ||
      !Array.isArray(analysis.requests) ||
      !Array.isArray(analysis.praises) ||
      !Array.isArray(analysis.segments) ||
      !analysis.sentiment_summary ||
      !Array.isArray(analysis.quotes) ||
      !Array.isArray(analysis.hidden_patterns) ||
      !Array.isArray(analysis.ideas);

    if (hasDefaults) {
      console.warn("[DeepAnalysis] Некоторые поля были заполнены fallback значениями. Структура исправлена.");
    }

    return validatedAnalysis;
  } catch (error) {
    console.error("[DeepAnalysis] Error:", error);
    if (error instanceof Error) {
      throw new Error(`Deep analysis failed: ${error.message}`);
    }
    throw new Error("Deep analysis failed with unknown error");
  }
}

/**
 * Объединяет результаты анализа нескольких чанков
 */
export function combineChunkResults(
  results: DeepAnalysisResult[]
): Omit<CombinedDeepAnalysis, 'totalAnalyzed' | 'language'> {
  const combined: Omit<CombinedDeepAnalysis, 'totalAnalyzed' | 'language'> = {
    themes: [],
    painPoints: [],
    requests: [],
    praises: [],
    audienceSegments: [],
    sentimentSummary: {
      positive: 0,
      negative: 0,
      neutral: 0,
    },
    topQuotes: [],
    hiddenPatterns: [],
    actionableIdeas: [],
  };

  // Собираем все данные
  for (const result of results) {
    combined.themes.push(...result.themes);
    combined.painPoints.push(...result.pain_points);
    combined.requests.push(...result.requests);
    combined.praises.push(...result.praises);
    combined.audienceSegments.push(...result.segments);
    combined.topQuotes.push(...result.quotes);
    combined.hiddenPatterns.push(...result.hidden_patterns);
    combined.actionableIdeas.push(...result.ideas);

    // Суммируем sentiment
    combined.sentimentSummary.positive += result.sentiment_summary.positive;
    combined.sentimentSummary.negative += result.sentiment_summary.negative;
    combined.sentimentSummary.neutral += result.sentiment_summary.neutral;
  }

  // Удаляем дубликаты и оставляем топ элементов
  combined.themes = [...new Set(combined.themes)].slice(0, 10);
  combined.painPoints = [...new Set(combined.painPoints)].slice(0, 10);
  combined.requests = [...new Set(combined.requests)].slice(0, 10);
  combined.praises = [...new Set(combined.praises)].slice(0, 10);
  combined.audienceSegments = [...new Set(combined.audienceSegments)].slice(0, 8);
  combined.topQuotes = [...new Set(combined.topQuotes)].slice(0, 15);
  combined.hiddenPatterns = [...new Set(combined.hiddenPatterns)].slice(0, 8);
  combined.actionableIdeas = [...new Set(combined.actionableIdeas)].slice(0, 10);

  // Нормализуем sentiment (средние значения)
  const totalSentiment =
    combined.sentimentSummary.positive +
    combined.sentimentSummary.negative +
    combined.sentimentSummary.neutral;

  if (totalSentiment > 0) {
    combined.sentimentSummary.positive = Math.round(
      (combined.sentimentSummary.positive / totalSentiment) * 100
    );
    combined.sentimentSummary.negative = Math.round(
      (combined.sentimentSummary.negative / totalSentiment) * 100
    );
    combined.sentimentSummary.neutral = Math.round(
      (combined.sentimentSummary.neutral / totalSentiment) * 100
    );
  }

  return combined;
}

/**
 * Основная функция для глубокого анализа комментариев канала
 */
export async function analyzeChannelComments(
  comments: CommentForAnalysis[],
  language: string = "en",
  channelId?: string
): Promise<CombinedDeepAnalysis> {
  console.log(`[analyzeChannelComments] Starting analysis of ${comments.length} comments, language: ${language}`);

  try {
    // 1. Нормализация
    const normalizedComments = normalizeComments(comments);
    console.log(`[analyzeChannelComments] Normalized to ${normalizedComments.length} comments`);

    if (normalizedComments.length === 0) {
      throw new Error("No valid comments to analyze after normalization");
    }

    // 2. Разбивка на чанки
    const chunks = chunkComments(normalizedComments);
    console.log(`[analyzeChannelComments] Split into ${chunks.length} chunks`);

    // Обновляем прогресс: начинаем обработку
    if (channelId) {
      await updateProgress(channelId, 0, chunks.length, 'processing');
    }

    // 3. Анализ каждого чанка
    const chunkResults: DeepAnalysisResult[] = [];
    let failedChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[analyzeChannelComments] Analyzing chunk ${i + 1}/${chunks.length}`);
      try {
        const result = await generateDeepAnalysis(chunks[i], language);
        chunkResults.push(result);

        // Обновляем прогресс после каждого чанка
        if (channelId) {
          await updateProgress(channelId, i + 1, chunks.length, 'processing');
        }

        // Небольшая задержка между запросами (rate limiting)
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        failedChunks++;
        console.error(`[analyzeChannelComments] Error analyzing chunk ${i + 1}/${chunks.length}:`, error);
        // Продолжаем с остальными чанками
      }
    }

    console.log(`[analyzeChannelComments] Chunk analysis complete: ${chunkResults.length} successful, ${failedChunks} failed out of ${chunks.length}`);

    if (chunkResults.length === 0) {
      throw new Error(`All ${chunks.length} chunk analyses failed. Cannot proceed.`);
    }

    // 4. Объединение результатов
    const combined = combineChunkResults(chunkResults);

    console.log("[analyzeChannelComments] Analysis completed successfully");

    // Обновляем прогресс: завершено
    if (channelId) {
      await updateProgress(channelId, chunks.length, chunks.length, 'done');
    }

    return {
      ...combined,
      totalAnalyzed: normalizedComments.length,
      language,
    };
  } catch (error) {
    // Обновляем прогресс: ошибка
    if (channelId) {
      await updateProgress(channelId, 0, 0, 'error');
    }
    throw error;
  }
}
