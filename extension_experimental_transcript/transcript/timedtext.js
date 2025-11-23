/**
 * YouTube Timedtext API - получение субтитров через /api/timedtext
 * Используется как резервный метод
 */

import { parseXML, cleanText, log, logError } from './utils.js';

/**
 * Получает субтитры через Timedtext API
 * @param {string} baseUrl - Base URL для субтитров (из captionTracks)
 * @returns {Promise<Array|null>} Массив сегментов субтитров или null
 */
export async function getTranscriptViaTimedtext(baseUrl) {
  const MODULE = "TIMEDTEXT";

  try {
    if (!baseUrl) {
      log(MODULE, "No baseUrl provided");
      return null;
    }

    log(MODULE, `Fetching transcript from: ${baseUrl.substring(0, 120)}...`);

    const response = await fetch(baseUrl);

    if (!response.ok) {
      const errorText = await response.text();
      logError(MODULE, `HTTP error response:`, errorText.substring(0, 300));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    log(MODULE, `Received XML length: ${xmlText.length} chars`);
    log(MODULE, `XML preview: ${xmlText.substring(0, 200)}`);

    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error("Empty caption XML response");
    }

    const segments = parseTimedtextXML(xmlText);

    if (segments && segments.length > 0) {
      log(MODULE, `Successfully extracted ${segments.length} segments`);
      return segments;
    } else {
      log(MODULE, "No segments found in XML");
      return null;
    }

  } catch (error) {
    logError(MODULE, "Failed to get transcript:", error.message);
    return null;
  }
}

/**
 * Парсит XML субтитров Timedtext API
 * @param {string} xmlText - XML текст
 * @returns {Array} Массив сегментов
 */
function parseTimedtextXML(xmlText) {
  try {
    const xmlDoc = parseXML(xmlText);

    // Проверяем на ошибки парсинга
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error("XML parsing error");
    }

    // Находим все элементы <text>
    const textElements = xmlDoc.querySelectorAll('text');

    if (!textElements || textElements.length === 0) {
      return [];
    }

    const segments = [];
    textElements.forEach((element, index) => {
      const start = parseFloat(element.getAttribute('start')) || 0;
      const duration = parseFloat(element.getAttribute('dur')) || 0;
      const text = element.textContent || "";

      if (text.trim()) {
        segments.push({
          index: index,
          start: start,
          end: start + duration,
          duration: duration,
          text: cleanText(text)
        });
      }
    });

    return segments;

  } catch (error) {
    logError("parseTimedtextXML", "Failed to parse XML:", error);
    return [];
  }
}

/**
 * Извлекает baseUrl из captionTracks
 * @param {Array} captionTracks - Массив captionTracks
 * @param {string} preferredLanguage - Предпочитаемый язык (код)
 * @returns {string|null} baseUrl или null
 */
export function extractBaseUrl(captionTracks, preferredLanguage = "en") {
  try {
    if (!captionTracks || captionTracks.length === 0) {
      log("extractBaseUrl", "No caption tracks provided");
      return null;
    }

    log("extractBaseUrl", `Available tracks: ${captionTracks.length}`);
    captionTracks.forEach((t, i) => {
      log("extractBaseUrl", `Track ${i}: ${t.language} (${t.languageCode}/${t.vssId})`);
    });

    // Пробуем найти предпочитаемый язык
    let track = captionTracks.find(t =>
      t.languageCode === preferredLanguage ||
      t.vssId === preferredLanguage ||
      t.vssId === `.${preferredLanguage}`
    );

    // Если не нашли, берём первый доступный
    if (!track) {
      log("extractBaseUrl", `Preferred language ${preferredLanguage} not found, using first track`);
      track = captionTracks[0];
    } else {
      log("extractBaseUrl", `Found preferred language: ${track.language}`);
    }

    const baseUrl = track.baseUrl || null;
    if (baseUrl) {
      log("extractBaseUrl", `BaseUrl length: ${baseUrl.length} chars`);
    }

    return baseUrl;

  } catch (error) {
    logError("extractBaseUrl", "Failed to extract baseUrl:", error);
    return null;
  }
}
