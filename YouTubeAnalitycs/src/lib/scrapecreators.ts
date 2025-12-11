// =============================================================================
// ИНТЕРФЕЙСЫ ДЛЯ НОРМАЛИЗОВАННЫХ ДАННЫХ (используются в приложении)
// =============================================================================

export interface ChannelData {
  channelId: string;
  title: string;
  handle: string;
  avatarUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export interface VideoData {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate: string | null; // ISO 8601 формат из API (полная строка, без обрезки)
  duration?: string; // ISO 8601 формат (PT1H2M10S) или undefined
}

/**
 * Ответ от getYoutubeChannelVideos с поддержкой пагинации
 * ИТЕРАЦИЯ 11: добавлена поддержка continuationToken для загрузки следующих страниц видео
 */
export interface ChannelVideosResponse {
  videos: VideoData[];
  continuationToken: string | null;
}

// =============================================================================
// ИНТЕРФЕЙСЫ ДЛЯ RAW API ОТВЕТОВ ScrapeCreators
// Документация: см. "Документация Scrapecreators YouTube API.txt"
// =============================================================================

/**
 * RAW ответ /v1/youtube/channel
 * Поля могут быть числовыми ИЛИ текстовыми (с суффиксами K/M/B)
 */
interface ScrapeCreatorsChannelResponse {
  channelId: string;
  name: string;
  avatar?: {
    image?: {
      sources?: Array<{ url: string; width?: number; height?: number }>;
    };
  } | string;
  subscriberCount?: number;
  subscriberCountText?: string; // "1.2M subscribers"
  videoCount?: number;
  videoCountText?: string; // "500 videos"
  viewCount?: number;
  viewCountText?: string; // "10M views"
}

/**
 * RAW ответ /v1/youtube/channel-videos
 * ВАЖНО: использует publishedTime (не publishDate!)
 */
interface ScrapeCreatorsChannelVideosResponse {
  videos: Array<{
    videoId: string;
    title: string;
    thumbnail?: string | { url: string };
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    publishedTime?: string; // ISO 8601: "2025-01-23T22:48:53.914Z"
    lengthSeconds?: number;
  }>;
  continuationToken?: string;
}

/**
 * RAW ответ /v1/youtube/video
 * ВАЖНО: использует publishDate (не publishedTime!)
 */
interface ScrapeCreatorsVideoResponse {
  videoId: string;
  title: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishDate?: string; // ISO 8601: "2019-02-22T00:00:00.000Z"
  durationMs?: number;
  keywords?: string[];
  transcript_only_text?: string;
}

/**
 * RAW комментарий из /v1/youtube/video/comments
 * Использует вложенные объекты author и engagement
 */
interface ScrapeCreatorsComment {
  id: string;
  content: string;
  publishedTime?: string;
  replyLevel?: number;
  author?: {
    name?: string;
    channelId?: string;
    isCreator?: boolean;
    isVerified?: boolean;
  };
  engagement?: {
    likes?: number;
    replies?: number;
  };
}

/**
 * RAW ответ /v1/youtube/video/comments
 */
interface ScrapeCreatorsCommentsResponse {
  comments: ScrapeCreatorsComment[];
  continuationToken?: string;
}

const API_BASE = "https://api.scrapecreators.com/v1/youtube/channel";
const API_VIDEOS_BASE = "https://api.scrapecreators.com/v1/youtube/channel-videos";

/**
 * Проверяет, является ли ответ HTML вместо JSON
 */
function isHtmlResponse(text: string): boolean {
  return text.trim().startsWith("<!DOCTYPE html>") || text.trim().startsWith("<html");
}

/**
 * Извлекает URL аватара из разных форматов ответа API
 */
function extractAvatarUrl(avatar: any): string | null {
  if (!avatar) {
    console.log("[extractAvatarUrl] avatar is null/undefined");
    return null;
  }

  console.log("[extractAvatarUrl] Processing avatar:", {
    avatarType: typeof avatar,
    isString: typeof avatar === "string",
    hasUrl: avatar?.url !== undefined,
    hasImage: avatar?.image !== undefined,
    keys: typeof avatar === "object" ? Object.keys(avatar).slice(0, 5) : "not-an-object",
  });

  // Случай 1: avatar уже строка
  if (typeof avatar === "string" && avatar.trim()) {
    console.log("[extractAvatarUrl] Case 1: avatar is string - returning");
    return avatar.trim();
  }

  // Случай 2: avatar.image.sources[] (вложенная структура)
  const sources = avatar?.image?.sources;
  if (Array.isArray(sources) && sources.length > 0) {
    // Берём последний элемент (обычно самое большое разрешение)
    const best = sources[sources.length - 1];
    if (best?.url && typeof best.url === "string") {
      console.log("[extractAvatarUrl] Case 2: avatar.image.sources[] - returning");
      return best.url.trim();
    }
  }

  // Случай 3: avatar.url напрямую
  if (avatar?.url && typeof avatar.url === "string") {
    console.log("[extractAvatarUrl] Case 3: avatar.url - returning");
    return avatar.url.trim();
  }

  // Случай 4: avatar_url (с подчеркиванием, если API использует snake_case)
  if (avatar?.avatar_url && typeof avatar.avatar_url === "string") {
    console.log("[extractAvatarUrl] Case 4: avatar_url - returning");
    return avatar.avatar_url.trim();
  }

  // Случай 5: avatarUrl (camelCase)
  if (avatar?.avatarUrl && typeof avatar.avatarUrl === "string") {
    console.log("[extractAvatarUrl] Case 5: avatarUrl - returning");
    return avatar.avatarUrl.trim();
  }

  console.log("[extractAvatarUrl] No matching avatar format found");
  return null;
}

/**
 * Безопасно конвертирует значение в число
 */
function safeNumber(value: any, fallback: number = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Парсит текстовые счётчики с суффиксами (K, M, B)
 * Например: "1.2K" → 1200, "10M" → 10000000, "1.5B" → 1500000000
 * Также обрабатывает строки вида "1.2K videos", "10M views"
 */
function parseTextCount(text: string | null | undefined): number {
  if (!text || typeof text !== "string") return 0;

  // Извлекаем число с возможным суффиксом
  const match = text.match(/^([\d,.]+)\s*([KMB])?/i);
  if (!match) return 0;

  const numStr = match[1].replace(/,/g, "");
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;

  const suffix = (match[2] || "").toUpperCase();
  switch (suffix) {
    case "K": return Math.round(num * 1_000);
    case "M": return Math.round(num * 1_000_000);
    case "B": return Math.round(num * 1_000_000_000);
    default: return Math.round(num);
  }
}

/**
 * Очищает handle от лишних символов и URL частей
 */
function cleanHandle(handle: string): string {
  return handle
    .replace(/^@/, "")
    .replace(/.*youtube\.com\/@?/, "")
    .replace(/.*youtube\.com\/channel\//, "")
    .split("/")[0]
    .trim();
}

/**
 * Конвертирует количество секунд в ISO 8601 формат длительности
 * Например: 3665 сек → PT1H1M5S
 */
function secondsToISO8601Duration(seconds: number | undefined | null): string | undefined {
  if (seconds === undefined || seconds === null || typeof seconds !== 'number' || seconds < 0) {
    return undefined;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let duration = 'PT';
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (secs > 0) duration += `${secs}S`;

  return duration === 'PT' ? undefined : duration;
}

export async function getYoutubeChannelByHandle(
  handle: string
): Promise<ChannelData> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  const cleanedHandle = cleanHandle(handle);
  const url = `${API_BASE}?handle=${encodeURIComponent(cleanedHandle)}`;

  console.log("[ScrapeCreators] Request:", {
    url,
    cleanedHandle,
    originalHandle: handle,
  });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const rawText = await response.text();

    console.log("[ScrapeCreators] Response:", {
      status: response.status,
      statusText: response.statusText,
      contentLength: rawText.length,
      isHtml: isHtmlResponse(rawText),
    });

    // Проверка на HTML ответ
    if (isHtmlResponse(rawText)) {
      console.error("[ScrapeCreators] Received HTML instead of JSON");
      throw new Error(
        `ScrapeCreators returned HTML response (status ${response.status}). API may be down or rate limited.`
      );
    }

    // Безопасный парсинг JSON
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[ScrapeCreators] JSON parse error:", rawText.slice(0, 200));
      throw new Error(
        `ScrapeCreators returned invalid JSON: ${rawText.slice(0, 100)}...`
      );
    }

    // Обработка ошибок API
    if (!response.ok) {
      console.error("[ScrapeCreators] API error:", { status: response.status, data });

      if (response.status === 404) {
        throw new Error("Channel not found. Check if the handle is correct.");
      } else if (response.status === 401) {
        throw new Error("Invalid API key. Check SCRAPECREATORS_API_KEY.");
      } else if (response.status === 429) {
        throw new Error("ScrapeCreators rate limit exceeded. Please try again later.");
      } else if (response.status >= 500) {
        throw new Error(
          `ScrapeCreators server error (${response.status}). The service may be temporarily unavailable.`
        );
      } else {
        throw new Error(
          `ScrapeCreators API error: ${response.status} - ${JSON.stringify(data).slice(0, 200)}`
        );
      }
    }

    // Нормализация данных
    console.log("[ScrapeCreators] API response keys:", Object.keys(data).slice(0, 10));
    console.log("[ScrapeCreators] Avatar field:", {
      avatar: data.avatar,
      avatarUrl: data.avatarUrl,
      avatar_url: data.avatar_url,
      channelAvatar: data.channelAvatar,
    });

    const extractedAvatarUrl = extractAvatarUrl(data.avatar);
    console.log("[ScrapeCreators] Extracted avatar URL:", {
      result: extractedAvatarUrl,
      extracted: extractedAvatarUrl !== null ? "YES" : "NO",
    });

    // Логирование отсутствующих документированных полей для диагностики
    if (data.subscriberCount == null && !data.subscriberCountText) {
      console.warn("[ScrapeCreators] subscriberCount/subscriberCountText missing for channel", data.channelId);
    }
    if (data.videoCount == null && !data.videoCountText) {
      console.warn("[ScrapeCreators] videoCount/videoCountText missing for channel", data.channelId);
    }
    if (data.viewCount == null && !data.viewCountText) {
      console.warn("[ScrapeCreators] viewCount/viewCountText missing for channel", data.channelId);
    }

    // Нормализация: API может возвращать числа напрямую ИЛИ текстовые версии
    // ВАЖНО: используем ТОЛЬКО документированные поля (subscriberCount или subscriberCountText)
    // Никакого subscriberCountInt - этого поля нет в документации API
    const channelData: ChannelData = {
      channelId: String(data.channelId || data.id || ""),
      title: String(data.name || data.title || "Unknown Channel"),
      handle: cleanedHandle,
      avatarUrl: extractedAvatarUrl,
      subscriberCount: safeNumber(data.subscriberCount, 0) ||
        parseTextCount(data.subscriberCountText),
      videoCount: safeNumber(data.videoCount, 0) ||
        parseTextCount(data.videoCountText),
      viewCount: safeNumber(data.viewCount, 0) ||
        parseTextCount(data.viewCountText),
    };

    console.log("[ScrapeCreators] Normalized data:", channelData);

    return channelData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch channel data from ScrapeCreators");
  }
}

/**
 * Извлекает URL миниатюры из разных форматов ответа API
 */
function extractThumbnailUrl(thumbnail: any): string | null {
  if (!thumbnail) return null;

  // Случай 1: thumbnail уже строка
  if (typeof thumbnail === "string" && thumbnail.trim()) {
    return thumbnail.trim();
  }

  // Случай 2: thumbnail.url напрямую
  if (thumbnail?.url && typeof thumbnail.url === "string") {
    return thumbnail.url.trim();
  }

  // Случай 3: массив thumbnails
  if (Array.isArray(thumbnail) && thumbnail.length > 0) {
    const best = thumbnail[thumbnail.length - 1];
    if (typeof best === "string") return best.trim();
    if (best?.url && typeof best.url === "string") return best.url.trim();
  }

  return null;
}

/**
 * Получает список видео канала через ScrapeCreators API с поддержкой пагинации
 * Пробует сначала channelId, потом fallback на handle
 *
 * ИТЕРАЦИЯ 11: добавлена поддержка continuationToken для пагинации
 * @param channelId - ID канала YouTube
 * @param handle - handle канала (fallback)
 * @param maxVideos - максимальное количество видео для загрузки (без этого параметра загружает ВСЕ)
 * @param continuationToken - токен для продолжения загрузки с предыдущей страницы (ИТЕРАЦИЯ 11)
 * @returns объект с videos и continuationToken для следующей страницы
 */
export async function getYoutubeChannelVideos(
  channelId: string,
  handle?: string,
  maxVideos?: number,
  continuationToken?: string | null  // ИТЕРАЦИЯ 11: поддержка пагинации
): Promise<ChannelVideosResponse> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  console.log("[ScrapeCreators] Начало загрузки видео для channelId:", channelId, "handle:", handle, "maxVideos limit:", maxVideos || "unlimited", "continuationToken:", continuationToken ? "present" : "none");

  // Сначала пробуем с channelId
  try {
    const result = await fetchVideosFromAPI(apiKey, "channelId", channelId, maxVideos, continuationToken);

    // ВАЖНО: если channelId вернул пустой результат но есть handle, попробовать с handle
    if (result.videos.length === 0 && handle) {
      console.log("[ScrapeCreators] ⚠️ FALLBACK: channelId вернул 0 видео для", { channelId, handle });
      try {
        console.log("[ScrapeCreators] Fallback: пробуем получить видео через handle...");
        const fallbackResult = await fetchVideosFromAPI(apiKey, "handle", handle, maxVideos, continuationToken);
        console.log("[ScrapeCreators] Fallback результат:", { videosCount: fallbackResult.videos.length });

        if (fallbackResult.videos.length > 0) {
          console.log(`[ScrapeCreators] ✅ Fallback сработал! Получено ${fallbackResult.videos.length} видео через handle`);
          return fallbackResult;
        } else {
          console.log("[ScrapeCreators] ⚠️ Fallback на handle вернул тоже 0 видео");
        }
      } catch (fallbackError) {
        console.error("[ScrapeCreators] ❌ Fallback на handle выбросил ошибку:", {
          errorMessage: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          handle,
          channelId
        });
        // Если fallback тоже не сработал, возвращаем пустой результат с логированием
      }
    }

    console.log("[ScrapeCreators] Возвращаем результат (channelId):", { videosCount: result.videos.length, channelId, handle });
    return result;
  } catch (error) {
    console.warn("[ScrapeCreators] Не удалось загрузить по channelId:", error instanceof Error ? error.message : error);

    // Если есть handle - пробуем fallback
    if (handle) {
      console.log("[ScrapeCreators] Ошибка channelId - попробуем fallback на handle");
      try {
        return await fetchVideosFromAPI(apiKey, "handle", handle, maxVideos, continuationToken);
      } catch (fallbackError) {
        console.error("[ScrapeCreators] Fallback на handle тоже не сработал:", fallbackError instanceof Error ? fallbackError.message : fallbackError);
        throw new Error("ScrapeCreators: videos unavailable for this channel");
      }
    }

    // Если handle нет - пробрасываем оригинальную ошибку
    throw error;
  }
}

/**
 * Внутренняя функция для загрузки видео с указанными параметрами
 * @param maxVideos - максимальное количество видео для загрузки (остановиться при достижении)
 * @param initialToken - начальный continuationToken для загрузки следующей страницы (ИТЕРАЦИЯ 11)
 */
async function fetchVideosFromAPI(
  apiKey: string,
  paramType: "channelId" | "handle",
  paramValue: string,
  maxVideos?: number,
  initialToken?: string | null  // ИТЕРАЦИЯ 11: поддержка пагинации
): Promise<ChannelVideosResponse> {
  const allVideos: VideoData[] = [];
  let continuationToken: string | null = initialToken || null;  // ИТЕРАЦИЯ 11: начинаем с переданного токена
  let pageCount = 0;
  const maxPages = 5; // Ограничение на количество страниц для избежания бесконечных циклов

  try {
    do {
      pageCount++;

      // Формируем URL с параметрами
      // ВАЖНО: параметр sort для ScrapeCreators /v1/youtube/channel-videos:
      // - "popular" = сортировка по viewCountInt (по убыванию просмотров, самые просматриваемые сверху)
      // - "latest"  = сортировка по publishDate (по убыванию даты, самые новые сверху)
      // СТРАТЕГИЯ (ИТЕРАЦИЯ 12): используем ТОЛЬКО "popular" для TOP-12 самых популярных видео
      const params = new URLSearchParams({
        [paramType]: paramValue,
        sort: "popular",  // ✅ КРИТИЧЕСКИ: только popular для TOP-12 видео
        includeExtras: "true",
      });

      if (continuationToken) {
        params.append("continuationToken", continuationToken);
      }

      const url = `${API_VIDEOS_BASE}?${params.toString()}`;

      console.log(`[ScrapeCreators] Videos Request (page ${pageCount}, ${paramType}):`, {
        url,
        [paramType]: paramValue,
        continuationToken: continuationToken ? "present" : "none",
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      const rawText = await response.text();

      console.log(`[ScrapeCreators] Videos Response (page ${pageCount}):`, {
        status: response.status,
        statusText: response.statusText,
        contentLength: rawText.length,
        isHtml: isHtmlResponse(rawText),
      });

      // Проверка на HTML ответ
      if (isHtmlResponse(rawText)) {
        console.error("[ScrapeCreators] Received HTML instead of JSON");
        throw new Error(
          `ScrapeCreators returned HTML response (status ${response.status}). API may be down or rate limited.`
        );
      }

      // Безопасный парсинг JSON
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error("[ScrapeCreators] JSON parse error:", rawText.slice(0, 200));
        throw new Error(
          `ScrapeCreators returned invalid JSON: ${rawText.slice(0, 100)}...`
        );
      }

      // Обработка ошибок API
      if (!response.ok) {
        console.error("[ScrapeCreators] API error:", { status: response.status, data });

        if (response.status === 404) {
          throw new Error("Channel videos not found. Check if the channelId/handle is correct.");
        } else if (response.status === 401) {
          throw new Error("Invalid API key. Check SCRAPECREATORS_API_KEY.");
        } else if (response.status === 429) {
          throw new Error("ScrapeCreators rate limit exceeded. Please try again later.");
        } else if (response.status >= 500) {
          throw new Error(
            `ScrapeCreators server error (${response.status}). The service may be temporarily unavailable.`
          );
        } else {
          throw new Error(
            `ScrapeCreators API error: ${response.status} - ${JSON.stringify(data).slice(0, 200)}`
          );
        }
      }

      // Извлекаем видео из ответа
      // Пробуем несколько возможных структур API ответа
      let videos: any[] = [];
      let extractionMethod = "none";

      if (Array.isArray(data.videos)) {
        videos = data.videos;
        extractionMethod = "data.videos";
        console.log("[ScrapeCreators] Found videos in data.videos");
      } else if (Array.isArray(data.items)) {
        videos = data.items;
        extractionMethod = "data.items";
        console.log("[ScrapeCreators] Found videos in data.items");
      } else if (Array.isArray(data.result?.videos)) {
        videos = data.result.videos;
        extractionMethod = "data.result.videos";
        console.log("[ScrapeCreators] Found videos in data.result.videos");
      } else if (Array.isArray(data.data?.videos)) {
        videos = data.data.videos;
        extractionMethod = "data.data.videos";
        console.log("[ScrapeCreators] Found videos in data.data.videos");
      } else if (Array.isArray(data)) {
        videos = data;
        extractionMethod = "direct-array";
        console.log("[ScrapeCreators] Data itself is array");
      } else if (data && typeof data === 'object') {
        // FALLBACK: пробуем найти первый массив в объекте
        const keys = Object.keys(data);
        for (const key of keys) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            const firstItem = data[key][0];
            // Проверяем что это похоже на видео (имеет id/videoId и title)
            if ((firstItem.id || firstItem.videoId) && (firstItem.title || firstItem.name)) {
              videos = data[key];
              extractionMethod = `data.${key}`;
              console.log(`[ScrapeCreators] Found videos in data.${key} (fallback detection)`);
              break;
            }
          }
        }
      }

      // Примечание: videos найден успешно, но может быть пустым - это не ошибка
      if (videos.length === 0) {
        console.log("[ScrapeCreators] Videos array found but is empty");
      }

      console.log("[ScrapeCreators] Extracted videos count:", {
        rawVideosLength: videos.length,
        extractionMethod,
        dataStructure: {
          hasVideos: Array.isArray(data.videos),
          hasItems: Array.isArray(data.items),
          hasResultVideos: Array.isArray(data.result?.videos),
          hasDataVideos: Array.isArray(data.data?.videos),
          isArray: Array.isArray(data),
          dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'not-object',
        },
      });

      // DEBUG: логируем сырые данные первого видео и sample других видео
      if (videos.length > 0) {
        const firstVideo = videos[0];
        console.log("[ScrapeCreators] RAW first video from API:", {
          videoId: firstVideo.videoId,
          id: firstVideo.id,
          title: firstVideo.title,
          publishedTime: firstVideo.publishedTime,
          viewCount: firstVideo.viewCount,
          allKeys: Object.keys(firstVideo),
        });

        // Логируем статистику по всем видео
        const videosWithId = videos.filter((v: any) => v.id || v.videoId).length;
        const videosWithoutId = videos.length - videosWithId;
        console.log("[ScrapeCreators] Video ID statistics:", {
          totalVideos: videos.length,
          videosWithId,
          videosWithoutId,
          sampledVideoIds: videos.slice(0, 3).map((v: any) => v.id || v.videoId || 'MISSING'),
        });
      } else {
        console.warn("[ScrapeCreators] WARNING: No videos extracted from API response!");
        if (data && typeof data === 'object') {
          console.warn("[ScrapeCreators] Full API response structure (first 500 chars):", {
            dataSample: JSON.stringify(data).slice(0, 500),
            dataKeys: Object.keys(data),
            paramType,
            paramValue,
          });
        }
      }

      // Нормализуем и добавляем видео
      // ВАЖНО: API /v1/youtube/channel-videos не возвращает точную дату публикации,
      // только относительную ("2 years ago"). Поэтому здесь ставим null.
      // Точная дата будет получена через /v1/youtube/video → publishDate
      const normalizedVideos: VideoData[] = videos.map((video: any, index: number) => {
        // Не пытаемся извлечь дату из channel-videos API — она ненадёжна
        // Точная дата придёт из getYoutubeVideoDetails()
        const publishDate: string | null = null;

        // Извлекаем videoId из разных возможных полей
        const videoId = String(video.id || video.videoId || "").trim();

        // Логируем если videoId пустой
        if (!videoId && index < 3) {
          console.warn("[ScrapeCreators] Empty videoId for video at index", index, {
            hasId: !!video.id,
            hasVideoId: !!video.videoId,
            id: video.id,
            videoId: video.videoId,
            allKeys: Object.keys(video),
          });
        }

        return {
          videoId,
          title: String(video.title || video.name || "Untitled Video"),
          thumbnailUrl: extractThumbnailUrl(video.thumbnail || video.thumbnailUrl),
          viewCount: safeNumber(
            video.viewCount ?? video.viewCountInt ?? video.views,
            0
          ),
          likeCount: safeNumber(
            video.likeCount ?? video.likeCountInt ?? video.likes,
            0
          ),
          commentCount: safeNumber(
            video.commentCount ?? video.commentCountInt ?? video.comments,
            0
          ),
          publishDate,
          // Конвертируем lengthSeconds в ISO 8601 формат
          duration: secondsToISO8601Duration(
            video.lengthSeconds ?? video.duration ?? undefined
          ),
        };
      });

      allVideos.push(...normalizedVideos);

      console.log(`[ScrapeCreators] Page ${pageCount}: получено ${normalizedVideos.length} видео, всего: ${allVideos.length}`);

      // Проверяем наличие continuationToken для следующей страницы
      continuationToken = data.continuationToken || null;

      // 🔑 ОПТИМИЗАЦИЯ: остановиться если достигли maxVideos
      if (maxVideos && allVideos.length >= maxVideos) {
        console.log(`[ScrapeCreators] Достигнут лимит видео (${maxVideos}), прекращаем загрузку. Загружено: ${allVideos.length}`);
        break;
      }

      // Ограничиваем количество страниц
      if (pageCount >= maxPages) {
        console.log(`[ScrapeCreators] Достигнут лимит страниц (${maxPages}), останавливаем загрузку`);
        break;
      }

    } while (continuationToken);

    console.log("[ScrapeCreators] Всего загружено видео:", {
      totalCount: allVideos.length,
      pages: pageCount,
      continuationToken: continuationToken ? "present" : "none",  // ИТЕРАЦИЯ 11
      sample: allVideos[0],
    });

    // ИТЕРАЦИЯ 11: возвращаем объект с videos и continuationToken для пагинации
    return {
      videos: allVideos,
      continuationToken: continuationToken || null,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch channel videos from ScrapeCreators");
  }
}

/**
 * Получает детальную информацию о видео через ScrapeCreators API
 * @param url - полный URL видео (https://www.youtube.com/watch?v=...)
 */
export async function getYoutubeVideoDetails(url: string) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  const apiUrl = `https://api.scrapecreators.com/v1/youtube/video?url=${encodeURIComponent(url)}`;

  console.log("[ScrapeCreators] Video details request:", { url, apiUrl });

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const rawText = await response.text();

    console.log("[ScrapeCreators] Video details response:", {
      status: response.status,
      contentLength: rawText.length,
      isHtml: isHtmlResponse(rawText),
    });

    // Проверка на HTML ответ
    if (isHtmlResponse(rawText)) {
      console.error("[ScrapeCreators] Received HTML instead of JSON");
      throw new Error(
        `ScrapeCreators returned HTML response (status ${response.status}). API may be down or rate limited.`
      );
    }

    // Безопасный парсинг JSON
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[ScrapeCreators] JSON parse error:", rawText.slice(0, 200));
      throw new Error(
        `ScrapeCreators returned invalid JSON: ${rawText.slice(0, 100)}...`
      );
    }

    // Обработка ошибок API
    if (!response.ok) {
      console.error("[ScrapeCreators] API error:", { status: response.status, data });

      if (response.status === 404) {
        throw new Error("Video not found.");
      } else if (response.status === 401) {
        throw new Error("Invalid API key. Check SCRAPECREATORS_API_KEY.");
      } else if (response.status === 429) {
        throw new Error("ScrapeCreators rate limit exceeded. Please try again later.");
      } else if (response.status >= 500) {
        throw new Error(
          `ScrapeCreators server error (${response.status}). The service may be temporarily unavailable.`
        );
      } else {
        throw new Error(
          `ScrapeCreators API error: ${response.status} - ${JSON.stringify(data).slice(0, 200)}`
        );
      }
    }

    // Нормализация данных
    // ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ: data.publishDate из API /v1/youtube/video
    // Сохраняем полную ISO 8601 строку без обрезки
    const publishDate: string | null = data.publishDate ? String(data.publishDate) : null;

    // DEBUG: логируем поле publishDate из API
    console.log("[ScrapeCreators] publishDate from /v1/youtube/video:", publishDate);

    // Валидация: дата должна быть ISO 8601 и не в будущем
    let validatedPublishDate: string | null = null;
    if (publishDate) {
      const parsedDate = new Date(publishDate);
      const isValidDate = !isNaN(parsedDate.getTime());
      const isNotFuture = parsedDate <= new Date();

      if (isValidDate && isNotFuture) {
        validatedPublishDate = publishDate;
      } else {
        console.warn("[ScrapeCreators] Invalid or future publishDate:", { publishDate, isValidDate, isNotFuture });
      }
    }

    // Логирование отсутствующих документированных полей для диагностики
    if (data.likeCountInt == null) {
      console.warn("[ScrapeCreators] likeCountInt missing for video", data.id);
    }
    if (data.commentCountInt == null) {
      console.warn("[ScrapeCreators] commentCountInt missing for video", data.id);
    }
    if (data.viewCountInt == null) {
      console.warn("[ScrapeCreators] viewCountInt missing for video", data.id);
    }

    const videoDetails = {
      videoId: String(data.videoId || data.id || ""),
      title: String(data.title || data.name || "Untitled Video"),
      // ВАЖНО: используем ТОЛЬКО документированные поля из API
      // Документация гарантирует: viewCountInt, likeCountInt, commentCountInt
      likeCount: safeNumber(data.likeCountInt, 0),
      commentCount: safeNumber(data.commentCountInt, 0),
      viewCount: safeNumber(data.viewCountInt, 0),
      publishDate: validatedPublishDate,
      durationMs: safeNumber(data.durationMs ?? data.duration, undefined),
      keywords: Array.isArray(data.keywords) ? data.keywords : undefined,
      transcriptText: data.transcript_only_text || null,
    };

    console.log("[ScrapeCreators] Video details fetched:", {
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      publishDate: videoDetails.publishDate,
      likeCount: videoDetails.likeCount,
      commentCount: videoDetails.commentCount,
    });

    return videoDetails;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch video details from ScrapeCreators");
  }
}

/**
 * Получает комментарии к видео через ScrapeCreators API
 * @param params.url - полный URL видео
 * @param params.order - порядок сортировки (top | newest)
 * @param params.continuationToken - токен для пагинации
 * @param params.maxComments - максимальное количество комментариев для загрузки
 */
export async function getYoutubeVideoComments(params: {
  url: string;
  order?: "top" | "newest";
  continuationToken?: string;
  maxComments?: number;
}) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  const { url, order = "top", continuationToken, maxComments = 300 } = params;

  // Формируем URL с параметрами
  const urlParams = new URLSearchParams({
    url: url,
    order: order,
  });

  if (continuationToken) {
    urlParams.append("continuationToken", continuationToken);
  }

  const apiUrl = `https://api.scrapecreators.com/v1/youtube/video/comments?${urlParams.toString()}`;

  console.log("[ScrapeCreators] Comments request:", { url, order, maxComments });

  try {
    const allComments: any[] = [];
    let currentToken: string | null = continuationToken || null;
    let fetchedCount = 0;

    // Загружаем комментарии с учетом лимита
    while (fetchedCount < maxComments) {
      const requestUrl = currentToken
        ? `https://api.scrapecreators.com/v1/youtube/video/comments?${new URLSearchParams({ url, order, continuationToken: currentToken }).toString()}`
        : `https://api.scrapecreators.com/v1/youtube/video/comments?${new URLSearchParams({ url, order }).toString()}`;

      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      const rawText = await response.text();

      // Проверка на HTML ответ
      if (isHtmlResponse(rawText)) {
        console.error("[ScrapeCreators] Received HTML instead of JSON");
        throw new Error(
          `ScrapeCreators returned HTML response (status ${response.status}). API may be down or rate limited.`
        );
      }

      // Безопасный парсинг JSON
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error("[ScrapeCreators] JSON parse error:", rawText.slice(0, 200));
        throw new Error(
          `ScrapeCreators returned invalid JSON: ${rawText.slice(0, 100)}...`
        );
      }

      // Обработка ошибок API
      if (!response.ok) {
        console.error("[ScrapeCreators] API error:", { status: response.status, data });

        if (response.status === 402) {
          const error: any = new Error("Закончились кредиты ScrapeCreators API. Необходимо пополнить баланс.");
          error.code = "INSUFFICIENT_CREDITS";
          error.status = 402;
          throw error;
        } else if (response.status === 404) {
          throw new Error("Video comments not found.");
        } else if (response.status === 401) {
          throw new Error("Invalid API key. Check SCRAPECREATORS_API_KEY.");
        } else if (response.status === 429) {
          throw new Error("ScrapeCreators rate limit exceeded. Please try again later.");
        } else if (response.status >= 500) {
          throw new Error(
            `ScrapeCreators server error (${response.status}). The service may be temporarily unavailable.`
          );
        } else {
          throw new Error(
            `ScrapeCreators API error: ${response.status} - ${JSON.stringify(data).slice(0, 200)}`
          );
        }
      }

      // Извлекаем комментарии
      const comments = Array.isArray(data.comments) ? data.comments : Array.isArray(data) ? data : [];

      // Нормализуем комментарии
      // ВАЖНО: API возвращает вложенные объекты author и engagement
      // Структура ScrapeCreators: comment.author.{name, channelId, isCreator, isVerified}
      //                           comment.engagement.{likes, replies}
      //
      // Названия полей ДОЛЖНЫ совпадать с sync-channel-comments.ts:
      // - content → text (текст комментария)
      // - publishedTime → publishedAt (дата публикации)
      // - author.name → author (имя автора)
      // - engagement.likes → likes (количество лайков)
      const normalizedComments = comments.map((comment: any) => ({
        id: String(comment.id || comment.commentId || ""),
        text: String(comment.content || comment.text || ""),  // ✅ ИСПРАВЛЕНО: content → text
        publishedAt: String(comment.publishedTime || ""),     // ✅ ИСПРАВЛЕНО: publishedTime → publishedAt
        replyLevel: safeNumber(comment.replyLevel ?? comment.level, 0),
        // engagement - вложенный объект
        likes: safeNumber(comment.engagement?.likes ?? comment.likes ?? 0, 0),
        replies: safeNumber(comment.engagement?.replies ?? comment.replies ?? 0, 0),
        // author - вложенный объект (в sync-channel-comments используется только имя)
        author: String(comment.author?.name || comment.authorName || "Unknown"),  // ✅ ИСПРАВЛЕНО: authorName → author
        authorChannelId: String(comment.author?.channelId || comment.authorChannelId || ""),
        isVerified: Boolean(comment.author?.isVerified ?? comment.isVerified ?? false),
        isCreator: Boolean(comment.author?.isCreator ?? comment.isCreator ?? false),
      }));

      allComments.push(...normalizedComments);
      fetchedCount += normalizedComments.length;

      console.log(`[ScrapeCreators] Comments fetched: ${normalizedComments.length}, total: ${fetchedCount}`);

      // Проверяем токен продолжения
      currentToken = data.continuationToken || null;

      // Если токена нет или достигли лимита - прерываем
      if (!currentToken || fetchedCount >= maxComments) {
        break;
      }
    }

    console.log("[ScrapeCreators] Total comments loaded:", allComments.length);

    return {
      comments: allComments.slice(0, maxComments),
      continuationToken: currentToken,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch video comments from ScrapeCreators");
  }
}
