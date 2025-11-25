/**
 * Главный модуль для получения YouTube субтитров
 * Объединяет все методы с автоматическим fallback
 */

import { getTranscriptParamsViaNextAPI } from './next-api.js';
import { getTranscriptViaInternalAPI } from './internal-api.js';
import { getTranscriptViaTimedtext, extractBaseUrl } from './timedtext.js';
import { getDataFromYtInitial } from './ytinitial.js';
import { formatTime, log, logError } from './utils.js';

/**
 * Получает субтитры для YouTube видео с автоматическим fallback
 * @param {string} videoId - ID видео
 * @param {Object} options - Опции
 * @param {string} options.preferredLanguage - Предпочитаемый язык (по умолчанию "en")
 * @param {boolean} options.useCache - Использовать кэш (по умолчанию true)
 * @returns {Promise<Object>} Объект с субтитрами и метаданными
 */
export async function getTranscript(videoId, options = {}) {
  const MODULE = "ORCHESTRATOR";

  const {
    preferredLanguage = "en",
    useCache = true
  } = options;

  try {
    log(MODULE, `Starting transcript fetch for video: ${videoId}`);
    log(MODULE, `Preferred language: ${preferredLanguage}, Use cache: ${useCache}`);

    // 1. Проверяем кэш
    if (useCache) {
      const cached = getCachedTranscript(videoId);
      if (cached) {
        log(MODULE, "✅ Using cached transcript");
        return cached;
      }
    }

    let params = null;
    let captionTracks = [];

    // ═══════════════════════════════════════════════════════════════════
    // METHOD 0: YouTube NEXT API - получение params
    // ═══════════════════════════════════════════════════════════════════
    log(MODULE, "📡 METHOD 0: Attempting NEXT API...");
    try {
      const nextData = await getTranscriptParamsViaNextAPI(videoId);
      if (nextData && nextData.params) {
        params = nextData.params;
        log(MODULE, "✅ METHOD 0: Successfully got params from NEXT API");
      }
    } catch (error) {
      logError(MODULE, "❌ METHOD 0 failed:", error.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // METHOD 1: YouTube Internal API - основной метод
    // ═══════════════════════════════════════════════════════════════════
    if (params) {
      log(MODULE, "📡 METHOD 1: Attempting Internal API...");
      try {
        const segments = await getTranscriptViaInternalAPI(videoId, params);
        if (segments && segments.length > 0) {
          const result = createResult(videoId, segments, "internal_api", captionTracks);
          cacheTranscript(videoId, result);
          log(MODULE, "✅ METHOD 1: Success!");
          return result;
        }
      } catch (error) {
        logError(MODULE, "❌ METHOD 1 failed:", error.message);
      }
    } else {
      log(MODULE, "⏭️ METHOD 1: Skipped (no params)");
    }

    // ═══════════════════════════════════════════════════════════════════
    // METHOD 2: HTML Parsing - получаем captionTracks и params
    // ═══════════════════════════════════════════════════════════════════
    log(MODULE, "📡 METHOD 2: Attempting HTML Parsing...");
    try {
      const ytData = await getDataFromYtInitial(videoId);
      if (ytData) {
        captionTracks = ytData.captionTracks || [];

        // Если не получили params ранее, используем из HTML
        if (!params && ytData.params) {
          params = ytData.params;
          log(MODULE, "✅ METHOD 2: Got params from HTML");

          // Пробуем ещё раз Internal API с новыми params
          try {
            const segments = await getTranscriptViaInternalAPI(videoId, params);
            if (segments && segments.length > 0) {
              const result = createResult(videoId, segments, "internal_api_html", captionTracks);
              cacheTranscript(videoId, result);
              log(MODULE, "✅ METHOD 2: Success via Internal API!");
              return result;
            }
          } catch (error) {
            logError(MODULE, "Internal API retry failed:", error.message);
          }
        }

        log(MODULE, `✅ METHOD 2: Found ${captionTracks.length} caption tracks`);
      }
    } catch (error) {
      logError(MODULE, "❌ METHOD 2 failed:", error.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // METHOD 3: Timedtext API - используем baseUrl из captionTracks
    // ═══════════════════════════════════════════════════════════════════
    if (captionTracks.length > 0) {
      log(MODULE, "📡 METHOD 3: Attempting Timedtext API...");
      try {
        const baseUrl = extractBaseUrl(captionTracks, preferredLanguage);
        if (baseUrl) {
          const segments = await getTranscriptViaTimedtext(baseUrl);
          if (segments && segments.length > 0) {
            const result = createResult(videoId, segments, "timedtext", captionTracks);
            cacheTranscript(videoId, result);
            log(MODULE, "✅ METHOD 3: Success!");
            return result;
          }
        }
      } catch (error) {
        logError(MODULE, "❌ METHOD 3 failed:", error.message);
      }
    } else {
      log(MODULE, "⏭️ METHOD 3: Skipped (no caption tracks)");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ALL METHODS FAILED
    // ═══════════════════════════════════════════════════════════════════
    logError(MODULE, "❌ All methods failed to fetch transcript");
    throw new Error("Failed to fetch transcript: All methods exhausted");

  } catch (error) {
    logError(MODULE, "Fatal error:", error.message);
    throw error;
  }
}

/**
 * Создаёт результирующий объект
 * @param {string} videoId - ID видео
 * @param {Array} segments - Массив сегментов
 * @param {string} method - Метод получения
 * @param {Array} captionTracks - Доступные треки субтитров
 * @returns {Object} Результирующий объект
 */
function createResult(videoId, segments, method, captionTracks = []) {
  return {
    videoId,
    method,
    segments,
    totalSegments: segments.length,
    availableLanguages: captionTracks.map(t => ({
      language: t.language,
      languageCode: t.languageCode,
      vssId: t.vssId,
      kind: t.kind
    })),
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Сохраняет субтитры в кэш
 * @param {string} videoId - ID видео
 * @param {Object} data - Данные для кэширования
 */
function cacheTranscript(videoId, data) {
  try {
    const cacheKey = `yt_transcript_exp_${videoId}`;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    log("CACHE", `Cached transcript for ${videoId}`);
  } catch (error) {
    logError("CACHE", "Failed to cache transcript:", error);
  }
}

/**
 * Получает субтитры из кэша
 * @param {string} videoId - ID видео
 * @returns {Object|null} Кэшированные данные или null
 */
function getCachedTranscript(videoId) {
  try {
    const cacheKey = `yt_transcript_exp_${videoId}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logError("CACHE", "Failed to get cached transcript:", error);
    return null;
  }
}

/**
 * Очищает кэш субтитров
 * @param {string} videoId - ID видео (опционально)
 */
export function clearTranscriptCache(videoId = null) {
  try {
    if (videoId) {
      const cacheKey = `yt_transcript_exp_${videoId}`;
      localStorage.removeItem(cacheKey);
      log("CACHE", `Cleared cache for ${videoId}`);
    } else {
      // Очищаем весь кэш субтитров
      Object.keys(localStorage)
        .filter(key => key.startsWith("yt_transcript_exp_"))
        .forEach(key => localStorage.removeItem(key));
      log("CACHE", "Cleared all transcript cache");
    }
  } catch (error) {
    logError("CACHE", "Failed to clear cache:", error);
  }
}

/**
 * Получает полный текст субтитров
 * @param {Array} segments - Массив сегментов
 * @param {boolean} withTimestamps - Включать таймстампы
 * @returns {string} Полный текст
 */
export function getFullTranscriptText(segments, withTimestamps = false) {
  if (!segments || segments.length === 0) return "";

  if (withTimestamps) {
    return segments
      .map(segment => `[${formatTime(segment.start)}] ${segment.text}`)
      .join('\n');
  } else {
    return segments
      .map(segment => segment.text)
      .join(' ');
  }
}

/**
 * Поиск по субтитрам
 * @param {Array} segments - Массив сегментов
 * @param {string} query - Поисковый запрос
 * @param {boolean} caseSensitive - Учитывать регистр
 * @returns {Array} Найденные сегменты
 */
export function searchInTranscript(segments, query, caseSensitive = false) {
  if (!query || !segments) return segments || [];

  const normalizedQuery = caseSensitive ? query : query.toLowerCase();

  return segments.filter(segment => {
    const text = caseSensitive ? segment.text : segment.text.toLowerCase();
    return text.includes(normalizedQuery);
  });
}
