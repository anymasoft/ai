import { CommentForAnalysis } from "./comments-analysis";
import { generateEmotionalOverview } from "./comments-modules/emotional-overview";
import { generateKeyTopics } from "./comments-modules/key-topics";
import { generatePositiveTriggers } from "./comments-modules/positive-triggers";
import { generateNegativeTriggers } from "./comments-modules/negative-triggers";
import { generateFAQ } from "./comments-modules/faq";
import { generateAudienceSegments } from "./comments-modules/audience-segments";
import { generateBehavioralInsights } from "./comments-modules/behavioral-insights";
import { generateMissingElements } from "./comments-modules/missing-elements";
import { generateGrowthOpportunities } from "./comments-modules/growth-opportunities";
import { generateChecklist } from "./comments-modules/checklist";
import { countPositive, countNeutral, countNegative } from "./comments-modules/sentiment-analyzer";

/**
 * Структура для sentiment анализа
 */
export interface SentimentAnalysis {
  positive: number;
  neutral: number;
  negative: number;
}

/**
 * Общая структура результата анализа
 * Соответствует финальному JSON с 11 обязательными полями (включая sentiment)
 */
export interface DeepAnalysisOrchestratorResult {
  emotionalOverview: string;
  keyTopics: any[];
  positiveTriggers: any[];
  negativeTriggers: any[];
  faq: any[];
  audienceSegments: any[];
  behavioralInsights: string[];
  missingElements: string[];
  growthOpportunities: any[];
  checklist: string[];
  sentiment: SentimentAnalysis;
  totalAnalyzed: number;
  language: string;
}

/**
 * Основная функция orchestrator
 * Вызывает все 10 модулей + 3 микропромпта sentiment параллельно через Promise.all()
 * Гарантирует полный JSON результат с жёсткой структурой
 */
export async function analyzeCommentsWithOrchestrator(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<DeepAnalysisOrchestratorResult> {
  console.log(
    `[CommentsOrchestrator] Starting parallel analysis of ${comments.length} comments (language: ${language})`
  );

  try {
    // Запускаем все 10 модулей + 3 микропромпта sentiment параллельно
    const [
      emotionalOverview,
      keyTopics,
      positiveTriggers,
      negativeTriggers,
      faq,
      audienceSegments,
      behavioralInsights,
      missingElements,
      growthOpportunities,
      checklist,
      positiveCount,
      neutralCount,
      negativeCount,
    ] = await Promise.all([
      generateEmotionalOverview(comments, language),
      generateKeyTopics(comments, language),
      generatePositiveTriggers(comments, language),
      generateNegativeTriggers(comments, language),
      generateFAQ(comments, language),
      generateAudienceSegments(comments, language),
      generateBehavioralInsights(comments, language),
      generateMissingElements(comments, language),
      generateGrowthOpportunities(comments, language),
      generateChecklist(comments, language),
      countPositive(comments, language),
      countNeutral(comments, language),
      countNegative(comments, language),
    ]);

    console.log("[CommentsOrchestrator] All modules and sentiment analysis completed successfully");

    // Собираем результаты в финальную структуру
    const result: DeepAnalysisOrchestratorResult = {
      emotionalOverview: emotionalOverview || "",
      keyTopics: keyTopics || [],
      positiveTriggers: positiveTriggers || [],
      negativeTriggers: negativeTriggers || [],
      faq: faq || [],
      audienceSegments: audienceSegments || [],
      behavioralInsights: behavioralInsights || [],
      missingElements: missingElements || [],
      growthOpportunities: growthOpportunities || [],
      checklist: checklist || [],
      sentiment: {
        positive: positiveCount || 0,
        neutral: neutralCount || 0,
        negative: negativeCount || 0,
      },
      totalAnalyzed: comments.length,
      language,
    };

    // Валидируем что все поля присутствуют и не undefined
    const validated = validateResult(result);

    console.log(
      "[CommentsOrchestrator] Final result assembled and validated"
    );

    return validated;
  } catch (error) {
    console.error("[CommentsOrchestrator] Error during orchestration:", error);

    // Возвращаем безопасный пустой результат вместо ошибки
    return createEmptySafeResult(language, comments.length);
  }
}

/**
 * Валидирует результат - гарантирует что все поля присутствуют
 * и не содержат undefined или null
 */
function validateResult(
  result: DeepAnalysisOrchestratorResult
): DeepAnalysisOrchestratorResult {
  // Валидируем checklist: должно быть РОВНО 8 элементов
  let validatedChecklist = Array.isArray(result.checklist)
    ? result.checklist.slice(0, 8)
    : [];

  // Если меньше 8 элементов, добавляем пустые
  while (validatedChecklist.length < 8) {
    validatedChecklist.push("");
  }

  // Валидируем sentiment
  const sentiment: SentimentAnalysis = {
    positive: typeof result.sentiment?.positive === "number" ? result.sentiment.positive : 0,
    neutral: typeof result.sentiment?.neutral === "number" ? result.sentiment.neutral : 0,
    negative: typeof result.sentiment?.negative === "number" ? result.sentiment.negative : 0,
  };

  return {
    emotionalOverview: String(result.emotionalOverview || "").slice(0, 500),
    keyTopics: Array.isArray(result.keyTopics) ? result.keyTopics : [],
    positiveTriggers: Array.isArray(result.positiveTriggers)
      ? result.positiveTriggers
      : [],
    negativeTriggers: Array.isArray(result.negativeTriggers)
      ? result.negativeTriggers
      : [],
    faq: Array.isArray(result.faq) ? result.faq : [],
    audienceSegments: Array.isArray(result.audienceSegments)
      ? result.audienceSegments
      : [],
    behavioralInsights: Array.isArray(result.behavioralInsights)
      ? result.behavioralInsights
      : [],
    missingElements: Array.isArray(result.missingElements)
      ? result.missingElements
      : [],
    growthOpportunities: Array.isArray(result.growthOpportunities)
      ? result.growthOpportunities
      : [],
    checklist: validatedChecklist,
    sentiment,
    totalAnalyzed: result.totalAnalyzed || 0,
    language: result.language || "en",
  };
}

/**
 * Создаёт безопасный пустой результат с корректной структурой
 * Гарантирует что ВСЕ ПОЛЯ присутствуют даже при ошибках
 */
function createEmptySafeResult(
  language: "ru" | "en",
  commentCount: number
): DeepAnalysisOrchestratorResult {
  const emptyMsg =
    language === "ru"
      ? "Анализ не выполнен из-за ошибки."
      : "Analysis failed due to an error.";

  const checklist =
    language === "ru"
      ? [
          "Убрать: неиспользуемое",
          "Добавить: новые идеи",
          "Усилить: посыл",
          "Изменить: подход",
          "Частить: обновления",
          "Упростить: сложное",
          "Углубить: анализ",
          "Делать: регулярно",
        ]
      : [
          "Remove: unused",
          "Add: new ideas",
          "Amplify: message",
          "Change: approach",
          "Increase: updates",
          "Simplify: complex",
          "Deepen: analysis",
          "Do: regularly",
        ];

  return {
    emotionalOverview: emptyMsg,
    keyTopics: [],
    positiveTriggers: [],
    negativeTriggers: [],
    faq: [],
    audienceSegments: [],
    behavioralInsights: [],
    missingElements: [],
    growthOpportunities: [],
    checklist,
    sentiment: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
    totalAnalyzed: commentCount,
    language,
  };
}
