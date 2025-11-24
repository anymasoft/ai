// ═══════════════════════════════════════════════════════════════════
// TRANSCRIPT MODULE — Получение субтитров YouTube через API (БЕЗ КЛИКОВ)
// Объединенный модуль со всеми методами получения транскриптов
// ═══════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────
// UTILITIES — Вспомогательные функции
// ───────────────────────────────────────────────────────────────────

function generateRandomClientVersion() {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0].replace(/-/g, "");
  });
  const randomDate = dates[Math.floor(Math.random() * dates.length)];
  return `2.${randomDate}.00.00`;
}

function createYouTubeContext(clientName = "WEB") {
  return {
    context: {
      client: {
        clientName: clientName,
        clientVersion: generateRandomClientVersion(),
        hl: "en",
        gl: "US"
      }
    }
  };
}

function cleanText(text) {
  if (!text) return "";
  text = text.replace(/<[^>]*>/g, "");
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&laquo;": "«",
    "&raquo;": "»"
  };
  return text.replace(/&#\d+;|&\w+;/g, entity => entities[entity] || entity);
}

function formatTimeFromSeconds(seconds) {
  const hasHours = seconds >= 3600;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hasHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

function parseXML(xmlText) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlText, "text/xml");
}

async function fetchYouTubePageHtml(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const html = await response.text();
  if (!html || html.trim().length === 0) {
    throw new Error("Empty response from YouTube");
  }
  return html;
}

function log(module, ...args) {
  console.log(`[VideoReader Transcript:${module}]`, ...args);
}

function logError(module, ...args) {
  console.error(`[VideoReader Transcript:${module}]`, ...args);
}

// ───────────────────────────────────────────────────────────────────
// NEXT API — Получение params через YouTube NEXT API
// ───────────────────────────────────────────────────────────────────

async function getTranscriptParamsViaNextAPI(videoId) {
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
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

function extractParamsFromNextResponse(data) {
  try {
    const engagementPanels = data?.engagementPanels || [];
    for (const panel of engagementPanels) {
      const content = panel?.engagementPanelSectionListRenderer?.content;
      const panelContent = content?.structuredDescriptionContentRenderer?.items || [];

      for (const item of panelContent) {
        const transcriptRenderer = item?.transcriptRenderer;
        if (!transcriptRenderer) continue;

        const searchBox = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.header?.transcriptSearchBoxRenderer;
        const endpoint = searchBox?.onTextChangeCommand?.getTranscriptEndpoint;

        if (endpoint?.params) {
          const availableLanguages = extractAvailableLanguages(transcriptRenderer);
          return {
            params: endpoint.params,
            availableLanguages: availableLanguages
          };
        }
      }
    }

    const alternativeParams = findParamsAlternative(data);
    if (alternativeParams) return alternativeParams;

    return null;
  } catch (error) {
    logError("extractParams", "Failed to extract params:", error);
    return null;
  }
}

function findParamsAlternative(data) {
  try {
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

function extractAvailableLanguages(transcriptRenderer) {
  try {
    const footer = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.footer;
    const languageMenu = footer?.transcriptFooterRenderer?.languageMenu;
    const subMenuItems = languageMenu?.sortFilterSubMenuRenderer?.subMenuItems || [];

    return subMenuItems.map(item => ({
      language: item?.title || "",
      params: item?.continuation?.reloadContinuationData?.continuation || ""
    })).filter(lang => lang.language && lang.params);
  } catch (error) {
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────
// INTERNAL API — Получение субтитров через /youtubei/v1/get_transcript
// ───────────────────────────────────────────────────────────────────

async function getTranscriptViaInternalAPI(videoId, params) {
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

function extractSegmentsFromInternalAPI(data) {
  try {
    const actions = data?.actions || [];
    if (actions.length === 0) {
      logError("extractSegments", "No actions in response");
      return [];
    }

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

    const initialSegments = panelRenderer?.body
      ?.transcriptSegmentListRenderer
      ?.initialSegments || [];

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
          start: Number(startMs) / 1000,
          end: Number(endMs) / 1000,
          duration: (Number(endMs) - Number(startMs)) / 1000,
          text: cleanText(text)
        };
      })
      .filter(Boolean);

    return segments;
  } catch (error) {
    logError("extractSegments", "Failed to extract segments:", error);
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────
// TIMEDTEXT API — Получение субтитров через /api/timedtext
// ───────────────────────────────────────────────────────────────────

async function getTranscriptViaTimedtext(baseUrl) {
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

function parseTimedtextXML(xmlText) {
  try {
    const xmlDoc = parseXML(xmlText);
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error("XML parsing error");
    }

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

function extractBaseUrl(captionTracks, preferredLanguage = "en") {
  try {
    if (!captionTracks || captionTracks.length === 0) {
      log("extractBaseUrl", "No caption tracks provided");
      return null;
    }

    log("extractBaseUrl", `Available tracks: ${captionTracks.length}`);

    let track = captionTracks.find(t =>
      t.languageCode === preferredLanguage ||
      t.vssId === preferredLanguage ||
      t.vssId === `.${preferredLanguage}`
    );

    if (!track) {
      log("extractBaseUrl", `Preferred language ${preferredLanguage} not found, using first track`);
      track = captionTracks[0];
    } else {
      log("extractBaseUrl", `Found preferred language: ${track.language}`);
    }

    return track.baseUrl || null;
  } catch (error) {
    logError("extractBaseUrl", "Failed to extract baseUrl:", error);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────
// HTML PARSING — Извлечение данных из ytInitialPlayerResponse
// ───────────────────────────────────────────────────────────────────

async function getDataFromYtInitial(videoId) {
  const MODULE = "YTINITIAL";
  try {
    log(MODULE, `Fetching HTML for video: ${videoId}`);
    const html = await fetchYouTubePageHtml(videoId);

    const captionTracks = extractCaptionTracks(html);
    const params = extractTranscriptParams(html);

    if (captionTracks.length > 0 || params) {
      log(MODULE, `Found ${captionTracks.length} caption tracks and params: ${params ? 'YES' : 'NO'}`);
      return { captionTracks, params };
    } else {
      log(MODULE, "No caption data found in HTML");
      return null;
    }
  } catch (error) {
    logError(MODULE, "Failed to extract data from HTML:", error.message);
    return null;
  }
}

function extractCaptionTracks(html) {
  try {
    const parts = html.split('"captions":');
    if (parts.length < 2) return [];

    const captionsJson = parts[1].split(',"videoDetails')[0].replace(/\n/g, "");
    const captions = JSON.parse(captionsJson);
    const tracks = captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    return tracks.map(track => {
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

function extractTranscriptParams(html) {
  try {
    const parts = html.split('"getTranscriptEndpoint":');
    if (parts.length < 2) {
      log("extractTranscriptParams", "getTranscriptEndpoint not found in HTML");
      return null;
    }

    const paramsMatch = parts[1].split('"params":"')[1];
    if (!paramsMatch) {
      log("extractTranscriptParams", "params field not found");
      return null;
    }

    const params = paramsMatch.split('"')[0];
    log("extractTranscriptParams", `Extracted params: ${params.substring(0, 50)}...`);
    return params;
  } catch (error) {
    logError("extractTranscriptParams", "Failed to extract params:", error);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────
// ORCHESTRATOR — Главный метод с fallback между всеми методами
// ───────────────────────────────────────────────────────────────────

// Простой кэш транскриптов
const transcriptCache = new Map();

function getCachedTranscript(videoId) {
  return transcriptCache.get(videoId) || null;
}

function cacheTranscript(videoId, result) {
  transcriptCache.set(videoId, result);
  // Автоочистка через 10 минут
  setTimeout(() => {
    transcriptCache.delete(videoId);
  }, 10 * 60 * 1000);
}

function createResult(videoId, segments, method, captionTracks) {
  return {
    videoId,
    segments,
    method,
    availableLanguages: captionTracks.map(t => ({
      code: t.languageCode || t.vssId,
      name: t.language
    }))
  };
}

async function getTranscriptAPI(videoId, options = {}) {
  const MODULE = "ORCHESTRATOR";
  const { preferredLanguage = "en", useCache = true } = options;

  try {
    log(MODULE, `Starting transcript fetch for video: ${videoId}`);

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

    // METHOD 0: NEXT API - получение params
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

    // METHOD 1: Internal API с params
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

    // METHOD 2: HTML Parsing - получаем captionTracks и params
    log(MODULE, "📡 METHOD 2: Attempting HTML Parsing...");
    try {
      const ytData = await getDataFromYtInitial(videoId);
      if (ytData) {
        captionTracks = ytData.captionTracks || [];

        // Если не получили params ранее, используем из HTML
        if (!params && ytData.params) {
          params = ytData.params;
          log(MODULE, "✅ METHOD 2: Got params from HTML");

          // Пробуем Internal API с новыми params
          try {
            const segments = await getTranscriptViaInternalAPI(videoId, params);
            if (segments && segments.length > 0) {
              const result = createResult(videoId, segments, "internal_api_html", captionTracks);
              cacheTranscript(videoId, result);
              log(MODULE, "✅ METHOD 2: Success via Internal API!");
              return result;
            }
          } catch (error) {
            logError(MODULE, "❌ METHOD 2 Internal API retry failed:", error.message);
          }
        }
      }
    } catch (error) {
      logError(MODULE, "❌ METHOD 2 failed:", error.message);
    }

    // METHOD 3: Timedtext API
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
        } else {
          log(MODULE, "⏭️ METHOD 3: Skipped (no baseUrl)");
        }
      } catch (error) {
        logError(MODULE, "❌ METHOD 3 failed:", error.message);
      }
    } else {
      log(MODULE, "⏭️ METHOD 3: Skipped (no caption tracks)");
    }

    throw new Error("Failed to fetch transcript: All methods exhausted");
  } catch (error) {
    logError(MODULE, "❌ Failed to fetch transcript:", error.message);
    throw error;
  }
}

// ───────────────────────────────────────────────────────────────────
// PUBLIC API — Главная функция для использования в content script
// ───────────────────────────────────────────────────────────────────

async function getTranscript(videoId) {
  console.log('[VideoReader Transcript] 🚀 Получаем транскрипт через API (без кликов)...');

  if (!videoId) {
    console.error('[VideoReader Transcript] ❌ Video ID not found');
    return null;
  }

  try {
    const result = await getTranscriptAPI(videoId, {
      preferredLanguage: 'en',
      useCache: true
    });

    if (!result || !result.segments || result.segments.length === 0) {
      console.warn('[VideoReader Transcript] ⚠️ No transcript data received');
      return null;
    }

    console.log(`[VideoReader Transcript] ✅ Получено ${result.segments.length} сегментов субтитров`);
    console.log(`[VideoReader Transcript] 📊 Метод: ${result.method}`);
    console.log(`[VideoReader Transcript] 🌍 Доступные языки: ${result.availableLanguages.length}`);

    // Преобразуем в формат, совместимый с текущим кодом
    const subtitles = result.segments.map(segment => ({
      index: segment.index,
      time: formatTimeFromSeconds(segment.start),
      text: segment.text,
      start: segment.start,
      end: segment.end
    }));

    return subtitles;
  } catch (error) {
    console.error('[VideoReader Transcript] ❌ Ошибка получения транскрипта:', error);
    console.error('[VideoReader Transcript] Стек ошибки:', error.stack);
    return null;
  }
}

export { getTranscript };
