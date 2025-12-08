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
const DEEP_COMMENTS_PROMPT_RU = `Ты — эксперт по анализу поведения аудитории YouTube, специалист по когнитивным триггерам, эмоциональной аналитике и извлечению скрытых паттернов из больших массивов комментариев.

Тебе передан массив комментариев к видео канала. Каждый комментарий содержит текст, автора, количество лайков.

Твоя задача — провести глубокий многоуровневый анализ аудитории, выявив эмоциональные реакции, когнитивные паттерны, скрытые потребности, темы вызывающие вовлечённость, барьеры к росту и инсайты для улучшения контента.

Работай только с реальными данными. Никаких домыслов или фантазий.

ВЕРНИ ТОЛЬКО JSON в ТОЧНО ТАКОЙ СТРУКТУРЕ и НИЧЕГО БОЛЬШЕ:

{
  "emotionalOverview": "2-4 абзаца о преобладающем тоне, распределении эмоций, связи с автором",
  "keyTopics": [
    {
      "name": "название темы",
      "description": "что обсуждают люди",
      "examples": ["цитата 1", "цитата 2", "цитата 3"],
      "motive": "стоящий за темой мотив",
      "usage": "как использовать в контенте"
    }
  ],
  "positiveTriggers": [
    {
      "trigger": "название триггера",
      "what_praised": "что именно хвалят",
      "why_resonates": "почему вызывает отклик",
      "video_types": "какие видео усиливают"
    }
  ],
  "negativeTriggers": [
    {
      "trigger": "название",
      "what_causes_negativity": "что вызывает критику",
      "why_harmful": "почему мешает",
      "fix": "как исправить",
      "example": "пример из комментариев"
    }
  ],
  "faq": [
    {
      "question": "вопрос аудитории",
      "why_appears": "почему появляется",
      "action": "что делать автору"
    }
  ],
  "audienceSegments": [
    {
      "segment": "название сегмента",
      "description": "кто это",
      "writes_about": "что пишет",
      "understanding_level": "уровень понимания темы",
      "motives": "мотивы",
      "suitable_content": "какие видео подходят",
      "growth_strategy": "как увеличить этот сегмент"
    }
  ],
  "behavioralInsights": [
    "что люди лайкают",
    "какие темы вызывают длинные комментарии",
    "какие видео провоцируют споры",
    "что зрители называют уникальным"
  ],
  "missingElements": [
    "дефицит какой информации",
    "какой глубины не хватает",
    "что вызывает непонимание",
    "что люди спрашивают повторно"
  ],
  "growthOpportunities": [
    {
      "opportunity": "возможность",
      "based_on": "на основе каких комментариев",
      "how_use": "как использовать",
      "expected_effect": "ожидаемый эффект (ER, CTR, retention, подписчики)"
    }
  ],
  "checklist": [
    "Убрать →",
    "Добавить →",
    "Усилить →",
    "Изменить →",
    "Частить →",
    "Упростить →",
    "Углубить →",
    "Делать регулярно →"
  ]
}

КРИТИЧЕСКИЕ ПРАВИЛА:
1. ТОЛЬКО анализ по данным. Никаких выдумок.
2. Если данных мало — делай аккуратные выводы ("по имеющимся комментариям можно предположить…").
3. Никаких длинных цитат. Максимум 3-6 слов.
4. Не повторяй сами комментарии — анализируй их.
5. Все текстовые поля на русском языке.
6. Возвращай ТОЛЬКО JSON без дополнительного текста.`;

const DEEP_COMMENTS_PROMPT_EN = `You are an expert in analyzing YouTube audience behavior, a specialist in cognitive triggers, emotional analytics, and extracting hidden patterns from large arrays of comments.

You have been provided with an array of comments from video channels. Each comment contains text, author, and likes count.

Your task is to conduct a deep multi-level audience analysis, revealing emotional reactions, cognitive patterns, hidden needs, themes driving engagement, barriers to growth, and insights for content improvement.

Work only with real data. No hallucinations or fantasies.

RETURN ONLY JSON in this EXACT STRUCTURE:

{
  "emotionalOverview": "2-4 paragraphs about dominant tone, emotion distribution, creator connection",
  "keyTopics": [
    {
      "name": "topic name",
      "description": "what people discuss",
      "examples": ["quote 1", "quote 2", "quote 3"],
      "motive": "underlying motive",
      "usage": "how to use in content"
    }
  ],
  "positiveTriggers": [
    {
      "trigger": "trigger name",
      "what_praised": "what exactly they praise",
      "why_resonates": "why it resonates emotionally",
      "video_types": "which video types amplify"
    }
  ],
  "negativeTriggers": [
    {
      "trigger": "name",
      "what_causes_negativity": "what triggers criticism",
      "why_harmful": "why it harms engagement",
      "fix": "how to fix",
      "example": "example from comments"
    }
  ],
  "faq": [
    {
      "question": "audience question",
      "why_appears": "why it appears",
      "action": "what creator should do"
    }
  ],
  "audienceSegments": [
    {
      "segment": "segment name",
      "description": "who they are",
      "writes_about": "what they write about",
      "understanding_level": "topic comprehension level",
      "motives": "their motives",
      "suitable_content": "what content fits",
      "growth_strategy": "how to grow this segment"
    }
  ],
  "behavioralInsights": [
    "what people like",
    "which topics cause long comments",
    "which videos provoke debates",
    "what viewers call unique"
  ],
  "missingElements": [
    "missing information",
    "lacking depth",
    "causing confusion",
    "repeated questions"
  ],
  "growthOpportunities": [
    {
      "opportunity": "opportunity",
      "based_on": "which comments support this",
      "how_use": "how to leverage",
      "expected_effect": "expected impact (ER, CTR, retention, subs)"
    }
  ],
  "checklist": [
    "Remove →",
    "Add →",
    "Amplify →",
    "Change →",
    "Increase frequency →",
    "Simplify →",
    "Deepen →",
    "Do regularly →"
  ]
}

CRITICAL RULES:
1. ONLY analysis based on provided data. No hallucinations.
2. If data is limited — make careful conclusions ("based on available comments we can infer…").
3. No long quotes. Maximum 3-6 words.
4. Don't repeat comments — analyze them.
5. Return ONLY JSON with no additional text.`;

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
