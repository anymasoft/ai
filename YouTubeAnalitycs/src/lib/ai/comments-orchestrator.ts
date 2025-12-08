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

/**
 * Общая структура результата анализа
 * Соответствует финальному JSON с 10 обязательными полями
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
  totalAnalyzed: number;
  language: string;
}

/**
 * Основная функция orchestrator
 * Вызывает все 10 модулей параллельно через Promise.all()
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
    // Запускаем все 10 модулей параллельно
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
    ]);

    console.log("[CommentsOrchestrator] All modules completed successfully");

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
      totalAnalyzed: comments.length,
      language,
    };

    // Валидируем что все 10 полей присутствуют и не undefined
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
 * Валидирует результат - гарантирует что все 10 полей присутствуют
 * и не содержат undefined или null
 */
function validateResult(
  result: DeepAnalysisOrchestratorResult
): DeepAnalysisOrchestratorResult {
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
    checklist: Array.isArray(result.checklist) ? result.checklist : [],
    totalAnalyzed: result.totalAnalyzed || 0,
    language: result.language || "en",
  };
}

/**
 * Создаёт безопасный пустой результат с корректной структурой
 * Гарантирует что ВСЕ 10 ПОЛЕЙ присутствуют даже при ошибках
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
    totalAnalyzed: commentCount,
    language,
  };
}
