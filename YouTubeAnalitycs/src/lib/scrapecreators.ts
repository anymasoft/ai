export interface ChannelData {
  channelId: string;
  title: string;
  handle: string;
  avatarUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

const API_BASE = "https://api.scrapecreators.com/v1/youtube/channel";

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
