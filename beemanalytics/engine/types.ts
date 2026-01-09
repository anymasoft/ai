/**
 * AI Engine Types
 * Чистые типы для Content Generation Pipeline
 * Без привязки к видео, БД, метриками
 */

/**
 * Входные данные для первого этапа
 * Может быть:
 * - транскрипт видео
 * - сырой текст
 * - краткое описание идеи
 */
export type PipelineInput = {
  text: string;
  metadata?: {
    language?: string;
    topic?: string;
    targetAudience?: string;
  };
};

/**
 * Семантическая карта (Stage 1 output)
 * Результат анализа входного текста
 */
export type SemanticMap = {
  mergedTopics: string[];
  commonPatterns: string[];
  conflicts: string[];
  paradoxes: string[];
  emotionalSpikes: string[];
  visualMotifs: string[];
  audienceInterests: string[];
  rawSummary: string;
};

/**
 * Нарративный скелет (Stage 2 output)
 * Каркас будущего сценария
 */
export type NarrativeSkeleton = {
  coreIdea: string;
  centralParadox: string;
  mainConflict: string;
  mainQuestion: string;
  emotionalBeats: string[];
  storyBeats: string[];
  visualMotifs: string[];
  hookCandidates: string[];
  endingIdeas: string[];
};

/**
 * Финальный сценарий (Stage 3 output)
 * Готовый контент
 */
export type GeneratedScript = {
  title: string;
  hook: string;
  outline: string[];
  scriptText: string;
  whyItShouldWork: string;
};

/**
 * Полный результат pipeline
 */
export type PipelineOutput = {
  input: {
    text: string;
    length: number;
  };
  stages: {
    semanticMap: SemanticMap;
    narrativeSkeleton: NarrativeSkeleton;
    generatedScript: GeneratedScript;
  };
  metadata: {
    timestamp: number;
    model: string;
    totalTime?: number;
  };
};

/**
 * Конфигурация для OpenAI
 */
export type OpenAIConfig = {
  apiKey: string;
  model: string;
  temperatureMap: number;
  temperatureSkeleton: number;
  temperatureScript: number;
};
