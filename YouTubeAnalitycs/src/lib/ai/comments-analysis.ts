import OpenAI from "openai";
import { createClient } from "@libsql/client";

/**
 * Helper для обновления прогресса анализа в БД
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

    await client.execute({
      sql: `UPDATE channel_ai_comment_insights
            SET progress_current = ?, progress_total = ?, status = ?
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [current, total, status, channelId],
    });

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
 * Генерирует глубокий анализ одного чанка комментариев через GPT-4o-mini
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

  const systemPrompt = language === "ru"
    ? `Ты — эксперт по анализу аудитории YouTube.
Твоя задача — извлекать глубокие инсайты из реальных комментариев.
ВСЕГДА базируй инсайты ТОЛЬКО на предоставленных комментариях.
НИКОГДА не придумывай данные.
Если не уверен — скажи "Недостаточно данных".

ЗАДАЧА:
Проанализируй следующие комментарии YouTube глубоко.
ВЕРНИ ТОЛЬКО JSON в ТОЧНО ТАКОЙ СТРУКТУРЕ:

{
  "themes": [],
  "pain_points": [],
  "requests": [],
  "praises": [],
  "segments": [],
  "sentiment_summary": {
    "positive": 0,
    "negative": 0,
    "neutral": 0
  },
  "quotes": [],
  "hidden_patterns": [],
  "ideas": []
}

ПРАВИЛА:
- "themes": высокоуровневые темы, о которых говорит аудитория
- "pain_points": фрустрации, проблемы, жалобы
- "requests": что аудитория явно просит
- "praises": что им нравится или ценят
- "segments": группы пользователей (например: новички, эксперты, скептики)
- "quotes": реальные ТОЧНЫЕ цитаты из комментариев (максимум 1 предложение)
- "hidden_patterns": инсайты, которые не очевидны на поверхности
- "ideas": действенные предложения для автора канала

Делай инсайты краткими и реальными. Все текстовые поля на русском языке.`
    : `You are an expert YouTube audience research analyst.
Your job is to extract deep insights from real comments.
ALWAYS base insights ONLY on provided comments.
NEVER hallucinate.
If you are unsure — say "Not enough data".

TASK:
Analyze the following YouTube comments deeply.
RETURN JSON ONLY in this EXACT STRUCTURE:

{
  "themes": [],
  "pain_points": [],
  "requests": [],
  "praises": [],
  "segments": [],
  "sentiment_summary": {
    "positive": 0,
    "negative": 0,
    "neutral": 0
  },
  "quotes": [],
  "hidden_patterns": [],
  "ideas": []
}

RULES:
- "themes": high-level topics the audience talks about
- "pain_points": frustrations, problems, complaints
- "requests": what audience explicitly asks
- "praises": what they love or appreciate
- "segments": groups of users (e.g. beginners, experts, skeptics)
- "quotes": real exact quotes from comments (1 sentence max)
- "hidden_patterns": insights that are not obvious on surface
- "ideas": actionable suggestions for creator

Make insights concise and real.`;

  console.log(`[DeepAnalysis] Generating analysis for chunk (${chunk.length} chars, language: ${language})`);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[DeepAnalysis] Successfully generated analysis");

    const analysis: DeepAnalysisResult = JSON.parse(content);

    // Валидация структуры
    if (
      !Array.isArray(analysis.themes) ||
      !Array.isArray(analysis.pain_points) ||
      !Array.isArray(analysis.requests) ||
      !Array.isArray(analysis.praises) ||
      !Array.isArray(analysis.segments) ||
      !analysis.sentiment_summary ||
      !Array.isArray(analysis.quotes) ||
      !Array.isArray(analysis.hidden_patterns) ||
      !Array.isArray(analysis.ideas)
    ) {
      throw new Error("Invalid analysis structure from OpenAI");
    }

    return analysis;
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
        console.error(`[analyzeChannelComments] Error analyzing chunk ${i + 1}:`, error);
        // Продолжаем с остальными чанками
      }
    }

    if (chunkResults.length === 0) {
      throw new Error("All chunk analyses failed");
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
