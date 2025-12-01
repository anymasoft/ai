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
  publishedAt: string;
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
  if (!avatar) return null;

  // Случай 1: avatar уже строка
  if (typeof avatar === "string" && avatar.trim()) {
    return avatar.trim();
  }

  // Случай 2: avatar.image.sources[] (вложенная структура)
  const sources = avatar?.image?.sources;
  if (Array.isArray(sources) && sources.length > 0) {
    // Берём последний элемент (обычно самое большое разрешение)
    const best = sources[sources.length - 1];
    if (best?.url && typeof best.url === "string") {
      return best.url.trim();
    }
  }

  // Случай 3: avatar.url напрямую
  if (avatar?.url && typeof avatar.url === "string") {
    return avatar.url.trim();
  }

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
    const channelData: ChannelData = {
      channelId: String(data.channelId || data.id || ""),
      title: String(data.name || data.title || "Unknown Channel"),
      handle: cleanedHandle,
      avatarUrl: extractAvatarUrl(data.avatar),
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
 */
export async function getYoutubeChannelVideos(
  channelId: string
): Promise<VideoData[]> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  const allVideos: VideoData[] = [];
  let continuationToken: string | null = null;
  let pageCount = 0;
  const maxPages = 5; // Ограничение на количество страниц для избежания бесконечных циклов

  console.log("[ScrapeCreators] Начало загрузки видео для channelId:", channelId);

  try {
    do {
      pageCount++;

      // Формируем URL с параметрами
      const params = new URLSearchParams({
        channelId: channelId,
        sort: "latest",
        includeExtras: "true",
      });

      if (continuationToken) {
        params.append("continuationToken", continuationToken);
      }

      const url = `${API_VIDEOS_BASE}?${params.toString()}`;

      console.log(`[ScrapeCreators] Videos Request (page ${pageCount}):`, {
        url,
        channelId,
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
          throw new Error("Channel videos not found. Check if the channelId is correct.");
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
      const normalizedVideos: VideoData[] = videos.map((video: any) => ({
        videoId: String(video.videoId || video.id || ""),
        title: String(video.title || video.name || "Untitled Video"),
        thumbnailUrl: extractThumbnailUrl(video.thumbnail || video.thumbnailUrl),
        viewCount: safeNumber(
          video.viewCount ?? video.viewCountInt ?? video.views,
          0
        ),
        publishedAt: String(video.publishedAt || video.publishedDate || new Date().toISOString()),
      }));

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
