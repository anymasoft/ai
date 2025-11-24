/**
 * YouTube Internal API - получение субтитров через /youtubei/v1/get_transcript
 * Это основной метод для получения субтитров
 */

import { createYouTubeContext, cleanText, log, logError } from './utils.js';

/**
 * Получает субтитры через YouTube Internal API
 * @param {string} videoId - ID видео
 * @param {string} params - Закодированный params
 * @returns {Promise<Array|null>} Массив сегментов субтитров или null
 */
export async function getTranscriptViaInternalAPI(videoId, params) {
  const MODULE = "INTERNAL-API";

  try {
    if (!params) {
      log(MODULE, "No params provided");
      return null;
    }

    log(MODULE, `Fetching transcript for video: ${videoId}`);

    const url = "https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false";

    const body = {
      ...createYouTubeContext("WEB"),
      params: params
    };

    log(MODULE, `Request body:`, JSON.stringify(body).substring(0, 200));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": "2.0"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(MODULE, `Response error body:`, errorText.substring(0, 500));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error("Empty transcript response");
    }

    const data = JSON.parse(text);
    const segments = extractSegmentsFromInternalAPI(data);

    if (segments && segments.length > 0) {
      log(MODULE, `Successfully extracted ${segments.length} segments`);
      return segments;
    } else {
      log(MODULE, "No segments found in response");
      return null;
    }

  } catch (error) {
    logError(MODULE, "Failed to get transcript:", error.message);
    return null;
  }
}

/**
 * Извлекает сегменты из ответа Internal API
 * @param {Object} data - JSON ответ от API
 * @returns {Array} Массив сегментов
 */
function extractSegmentsFromInternalAPI(data) {
  try {
    const actions = data?.actions || [];
    if (actions.length === 0) {
      logError("extractSegments", "No actions in response");
      return [];
    }

    // Навигация по структуре ответа
    const panelRenderer = actions[0]
      ?.updateEngagementPanelAction
      ?.content
      ?.transcriptRenderer
      ?.content
      ?.transcriptSearchPanelRenderer;

    if (!panelRenderer) {
      logError("extractSegments", "Invalid response structure");
      return [];
    }

    // Извлекаем сегменты
    const initialSegments = panelRenderer?.body
      ?.transcriptSegmentListRenderer
      ?.initialSegments || [];

    // Преобразуем в нужный формат
    const segments = initialSegments
      .map((segment, index) => {
        const renderer = segment?.transcriptSegmentRenderer;
        if (!renderer) return null;

        const startMs = renderer.startMs;
        const endMs = renderer.endMs;
        const text = renderer.snippet?.runs?.[0]?.text || "";

        if (!startMs || !endMs || !text) return null;

        return {
          index: index,
          start: Number(startMs) / 1000,  // Конвертируем в секунды
          end: Number(endMs) / 1000,
          duration: (Number(endMs) - Number(startMs)) / 1000,
          text: cleanText(text)
        };
      })
      .filter(Boolean);  // Удаляем null значения

    return segments;

  } catch (error) {
    logError("extractSegments", "Failed to extract segments:", error);
    return [];
  }
}
