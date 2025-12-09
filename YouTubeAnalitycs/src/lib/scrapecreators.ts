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
  publishedAt: string | null; // Берется из API поля publishedTime, может быть null если API не вернул дату
  duration?: string; // ISO 8601 формат (PT1H2M10S) или undefined
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

    const channelData: ChannelData = {
      channelId: String(data.channelId || data.id || ""),
      title: String(data.name || data.title || "Unknown Channel"),
      handle: cleanedHandle,
      avatarUrl: extractedAvatarUrl,
      subscriberCount: safeNumber(
        data.subscriberCount ?? data.subscriberCountInt ?? data.subscribers,
        0
      ),
      videoCount: safeNumber(
        data.videoCount ?? data.videoCountInt ?? data.videos,
        0
      ),
      viewCount: safeNumber(
        data.viewCount ?? data.viewCountInt ?? data.views,
        0
      ),
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
 */
export async function getYoutubeChannelVideos(
  channelId: string,
  handle?: string
): Promise<VideoData[]> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  console.log("[ScrapeCreators] Начало загрузки видео для channelId:", channelId, "handle:", handle);

  // Сначала пробуем с channelId
  try {
    return await fetchVideosFromAPI(apiKey, "channelId", channelId);
  } catch (error) {
    console.warn("[ScrapeCreators] Не удалось загрузить по channelId:", error instanceof Error ? error.message : error);

    // Если есть handle - пробуем fallback
    if (handle) {
      console.log("[VideoSync] Using fallback from channelId → handle");
      try {
        return await fetchVideosFromAPI(apiKey, "handle", handle);
      } catch (fallbackError) {
        console.error("[ScrapeCreators] Fallback на handle тоже не сработал:", fallbackError);
        throw new Error("ScrapeCreators: videos unavailable for this channel");
      }
    }

    // Если handle нет - пробрасываем оригинальную ошибку
    throw error;
  }
}

/**
 * Внутренняя функция для загрузки видео с указанными параметрами
 */
async function fetchVideosFromAPI(
  apiKey: string,
  paramType: "channelId" | "handle",
  paramValue: string
): Promise<VideoData[]> {
  const allVideos: VideoData[] = [];
  let continuationToken: string | null = null;
  let pageCount = 0;
  const maxPages = 5; // Ограничение на количество страниц для избежания бесконечных циклов

  try {
    do {
      pageCount++;

      // Формируем URL с параметрами
      const params = new URLSearchParams({
        [paramType]: paramValue,
        sort: "latest",
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
      const videos = Array.isArray(data.videos) ? data.videos : Array.isArray(data) ? data : [];

      // Нормализуем и добавляем видео
      const normalizedVideos: VideoData[] = videos.map((video: any) => {
        // Извлекаем только дату (YYYY-MM-DD) из publishedTime
        const publishedTime = video.publishedTime;
        const publishedAt = publishedTime ? publishedTime.split("T")[0] : null;

        return {
          videoId: String(video.videoId || video.id || ""),
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
          publishedAt,
          // Конвертируем lengthSeconds в ISO 8601 формат
          duration: secondsToISO8601Duration(
            video.lengthSeconds ?? video.duration ?? undefined
          ),
        };
      });

      allVideos.push(...normalizedVideos);

      console.log(`[ScrapeCreators] Page ${pageCount}: получено ${normalizedVideos.length} видео`);

      // Проверяем наличие continuationToken для следующей страницы
      continuationToken = data.continuationToken || null;

      // Ограничиваем количество страниц
      if (pageCount >= maxPages) {
        console.log(`[ScrapeCreators] Достигнут лимит страниц (${maxPages}), останавливаем загрузку`);
        break;
      }

    } while (continuationToken);

    console.log("[ScrapeCreators] Всего загружено видео:", {
      totalCount: allVideos.length,
      pages: pageCount,
      sample: allVideos[0],
    });

    return allVideos;
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
    // Извлекаем только дату (YYYY-MM-DD) из publishedTime
    const publishedTime = data.publishedTime;
    const publishedAt = publishedTime ? publishedTime.split("T")[0] : null;

    const videoDetails = {
      videoId: String(data.videoId || data.id || ""),
      title: String(data.title || data.name || "Untitled Video"),
      likeCount: safeNumber(
        data.likeCount ?? data.likeCountInt ?? data.likes,
        0
      ),
      commentCount: safeNumber(
        data.commentCount ?? data.commentCountInt ?? data.comments,
        0
      ),
      viewCount: safeNumber(
        data.viewCount ?? data.viewCountInt ?? data.views,
        0
      ),
      publishedAt,
      durationMs: safeNumber(data.durationMs ?? data.duration, undefined),
      keywords: Array.isArray(data.keywords) ? data.keywords : undefined,
      transcriptText: data.transcript_only_text || null,
    };

    console.log("[ScrapeCreators] Video details fetched:", {
      videoId: videoDetails.videoId,
      title: videoDetails.title,
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
      // ВАЖНО: publishedTime берется ТОЛЬКО из API, без fallback'ов на текущую дату
      const normalizedComments = comments.map((comment: any) => ({
        id: String(comment.id || comment.commentId || ""),
        content: String(comment.content || comment.text || ""),
        publishedTime: String(comment.publishedTime || comment.publishedAt || ""),
        replyLevel: safeNumber(comment.replyLevel ?? comment.level, 0),
        likes: safeNumber(comment.likes ?? comment.likeCount, 0),
        replies: safeNumber(comment.replies ?? comment.replyCount, 0),
        authorName: String(comment.authorName || comment.author || "Unknown"),
        authorChannelId: String(comment.authorChannelId || comment.channelId || ""),
        isVerified: Boolean(comment.isVerified || comment.verified),
        isCreator: Boolean(comment.isCreator || comment.creator),
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
