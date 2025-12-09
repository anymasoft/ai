/**
 * Типы для генерации сценариев YouTube видео
 */

/**
 * Запрос на генерацию сценария
 */
export interface GenerateScriptRequest {
  selectedVideoIds: string[];
}

/**
 * Сгенерированный сценарий
 */
export interface GeneratedScript {
  title: string;
  hook: string;
  outline: string[];
  scriptText: string;
  whyItShouldWork: string;
}

/**
 * Сохранённый сценарий в БД
 */
export interface SavedScript extends GeneratedScript {
  id: string;
  userId: string;
  sourceVideos: string[];
  createdAt: number;
}

/**
 * Ответ на запрос генерации сценария
 */
export interface GenerateScriptResponse {
  scripts: GeneratedScript[];
}

/**
 * Ответ на запрос генерации сценария с сохранением
 */
export interface GenerateAndSaveScriptResponse {
  script: SavedScript;
}

/**
 * Ответ на запрос списка сценариев
 */
export interface ScriptsListResponse {
  scripts: SavedScript[];
}

/**
 * Данные видео для анализа GPT
 */
export interface VideoForAnalysis {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  publishDate: string;
  viewsPerDay?: number;
  momentumScore?: number;
  transcript?: string;
  keywords?: string[];
}

/**
 * Входные данные для GPT
 */
export interface GPTInputData {
  videos: VideoForAnalysis[];
  analysisPrompt: string;
}
