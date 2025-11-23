/**
 * YouTube NEXT API - получение params для get_transcript
 * Это новый метод для извлечения параметров транскрипта
 */

import { createYouTubeContext, log, logError } from './utils.js';

/**
 * Получает params для get_transcript через YouTube NEXT API
 * @param {string} videoId - ID видео
 * @returns {Promise<{params: string, availableLanguages: Array}|null>}
 */
export async function getTranscriptParamsViaNextAPI(videoId) {
  const MODULE = "NEXT-API";

  try {
    log(MODULE, `Fetching params for video: ${videoId}`);

    const url = "https://www.youtube.com/youtubei/v1/next?prettyPrint=false";

    const body = {
      ...createYouTubeContext("WEB"),
      videoId: videoId
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Извлекаем params из ответа
    const result = extractParamsFromNextResponse(data);

    if (result) {
      log(MODULE, `Successfully extracted params`);
      return result;
    } else {
      log(MODULE, `No params found in NEXT API response`);
      return null;
    }

  } catch (error) {
    logError(MODULE, "Failed to get params:", error.message);
    return null;
  }
}

/**
 * Извлекает params из ответа NEXT API
 * @param {Object} data - JSON ответ от NEXT API
 * @returns {{params: string, availableLanguages: Array}|null}
 */
function extractParamsFromNextResponse(data) {
  try {
    // Пробуем найти engagementPanels
    const engagementPanels = data?.engagementPanels || [];

    for (const panel of engagementPanels) {
      const content = panel?.engagementPanelSectionListRenderer?.content;
      const panelContent = content?.structuredDescriptionContentRenderer?.items || [];

      for (const item of panelContent) {
        const transcriptRenderer = item?.transcriptRenderer;
        if (!transcriptRenderer) continue;

        // Ищем getTranscriptEndpoint
        const searchBox = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.header?.transcriptSearchBoxRenderer;
        const endpoint = searchBox?.onTextChangeCommand?.getTranscriptEndpoint;

        if (endpoint?.params) {
          // Также извлекаем доступные языки из footer
          const availableLanguages = extractAvailableLanguages(transcriptRenderer);

          return {
            params: endpoint.params,
            availableLanguages: availableLanguages
          };
        }
      }
    }

    // Альтернативный путь поиска
    const alternativeParams = findParamsAlternative(data);
    if (alternativeParams) {
      return alternativeParams;
    }

    return null;

  } catch (error) {
    logError("extractParams", "Failed to extract params:", error);
    return null;
  }
}

/**
 * Альтернативный метод поиска params в response
 * @param {Object} data - JSON ответ
 * @returns {{params: string, availableLanguages: Array}|null}
 */
function findParamsAlternative(data) {
  try {
    // Рекурсивный поиск getTranscriptEndpoint
    const found = searchInObject(data, "getTranscriptEndpoint");

    if (found && found.params) {
      return {
        params: found.params,
        availableLanguages: []
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Рекурсивный поиск в объекте
 * @param {Object|Array} obj - Объект для поиска
 * @param {string} key - Ключ для поиска
 * @param {number} maxDepth - Максимальная глубина
 * @returns {any|null}
 */
function searchInObject(obj, key, maxDepth = 10) {
  if (maxDepth <= 0) return null;

  if (!obj || typeof obj !== 'object') return null;

  if (obj[key]) return obj[key];

  for (const k in obj) {
    if (typeof obj[k] === 'object') {
      const result = searchInObject(obj[k], key, maxDepth - 1);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Извлекает доступные языки из transcriptRenderer
 * @param {Object} transcriptRenderer - Объект transcriptRenderer
 * @returns {Array} Массив доступных языков
 */
function extractAvailableLanguages(transcriptRenderer) {
  try {
    const footer = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.footer;
    const languageMenu = footer?.transcriptFooterRenderer?.languageMenu;
    const subMenuItems = languageMenu?.sortFilterSubMenuRenderer?.subMenuItems || [];

    return subMenuItems.map(item => {
      const title = item?.title || "";
      const params = item?.continuation?.reloadContinuationData?.continuation || "";

      return {
        language: title,
        params: params
      };
    }).filter(lang => lang.language && lang.params);

  } catch (error) {
    return [];
  }
}
