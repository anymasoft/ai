/**
 * HTML Parsing - парсинг ytInitialPlayerResponse из HTML страницы
 * Извлекает captionTracks и params из встроенных данных YouTube
 */

import { fetchYouTubePageHtml, log, logError } from './utils.js';

/**
 * Получает данные из ytInitialPlayerResponse
 * @param {string} videoId - ID видео
 * @returns {Promise<{captionTracks: Array, params: string}|null>}
 */
export async function getDataFromYtInitial(videoId) {
  const MODULE = "YTINITIAL";

  try {
    log(MODULE, `Fetching HTML for video: ${videoId}`);

    const html = await fetchYouTubePageHtml(videoId);

    // Извлекаем captionTracks
    const captionTracks = extractCaptionTracks(html);

    // Извлекаем params для get_transcript
    const params = extractTranscriptParams(html);

    if (captionTracks.length > 0 || params) {
      log(MODULE, `Found ${captionTracks.length} caption tracks and params: ${params ? 'YES' : 'NO'}`);
      return {
        captionTracks,
        params
      };
    } else {
      log(MODULE, "No caption data found in HTML");
      return null;
    }

  } catch (error) {
    logError(MODULE, "Failed to extract data from HTML:", error.message);
    return null;
  }
}

/**
 * Извлекает captionTracks из HTML
 * @param {string} html - HTML страницы
 * @returns {Array} Массив captionTracks
 */
export function extractCaptionTracks(html) {
  try {
    // Метод 1: Split парсинг (быстрее regex)
    const parts = html.split('"captions":');
    if (parts.length < 2) {
      return [];
    }

    const captionsJson = parts[1].split(',"videoDetails')[0].replace(/\n/g, "");
    const captions = JSON.parse(captionsJson);

    const tracks = captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    return tracks.map(track => {
      // Удаляем точку в начале vssId, если есть
      let langCode = track.vssId || "";
      if (langCode.startsWith(".")) {
        langCode = langCode.slice(1);
      }

      return {
        baseUrl: track.baseUrl || "",
        language: track.name?.simpleText || "",
        languageCode: track.languageCode || "",
        vssId: langCode,
        kind: track.kind || "",
        isTranslatable: track.isTranslatable || false
      };
    });

  } catch (error) {
    logError("extractCaptionTracks", "Failed to extract caption tracks:", error);
    return [];
  }
}

/**
 * Извлекает params для get_transcript из HTML
 * @param {string} html - HTML страницы
 * @returns {string|null} params или null
 */
export function extractTranscriptParams(html) {
  try {
    const parts = html.split('"getTranscriptEndpoint":');
    if (parts.length < 2) {
      return null;
    }

    const paramsMatch = parts[1].split('"params":"')[1];
    if (!paramsMatch) {
      return null;
    }

    return paramsMatch.split('"')[0];

  } catch (error) {
    logError("extractTranscriptParams", "Failed to extract params:", error);
    return null;
  }
}

/**
 * Альтернативный метод: извлечение через regex
 * @param {string} html - HTML страницы
 * @returns {Object|null} ytInitialPlayerResponse или null
 */
export function extractYtInitialPlayerResponse(html) {
  try {
    // Ищем ytInitialPlayerResponse в HTML
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) {
      return null;
    }

    return JSON.parse(match[1]);

  } catch (error) {
    logError("extractYtInitialPlayerResponse", "Failed to extract ytInitialPlayerResponse:", error);
    return null;
  }
}
