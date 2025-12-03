/**
 * Результат нормализации YouTube input
 */
export interface NormalizedYoutubeInput {
  originalInput: string;
  normalizedHandle: string | null;
  channelId: string | null;
  type: "handle" | "url" | "channelId" | "unknown";
}

/**
 * Универсальная функция нормализации YouTube input
 *
 * Поддерживает:
 * - @handle (с кириллицей и Unicode)
 * - youtube.com/@handle URLs (с URL-encoded символами)
 * - Чистый handle без @
 *
 * @param input - Пользовательский ввод (handle, URL, или channelId)
 * @returns Нормализованный объект с типом входа
 */
export function normalizeYoutubeInput(input: string): NormalizedYoutubeInput {
  // 1. Trim + первичный decode
  let raw = decodeURIComponent(input.trim());

  // Результат по умолчанию
  const result: NormalizedYoutubeInput = {
    originalInput: input,
    normalizedHandle: null,
    channelId: null,
    type: "unknown",
  };

  // 2. Если это URL вида youtube.com/@handle
  const urlPattern = /youtube\.com\/@([^\/\s]+)/i;
  const urlMatch = raw.match(urlPattern);

  if (urlMatch) {
    // Извлекаем handle из URL и декодируем второй раз (для %D0% и т.д.)
    const encodedHandle = urlMatch[1];
    try {
      result.normalizedHandle = decodeURIComponent(encodedHandle);
    } catch {
      // Если decode не удался, используем как есть
      result.normalizedHandle = encodedHandle;
    }
    result.type = "url";
    return result;
  }

  // 3. Если ввод начинается с "@"
  if (raw.startsWith("@")) {
    result.normalizedHandle = raw.substring(1); // Убираем @
    result.type = "handle";
    return result;
  }

  // 4. Если это выглядит как channelId (UC... или 24 символа)
  if (/^UC[\w-]{22}$/.test(raw) || /^[\w-]{24}$/.test(raw)) {
    result.channelId = raw;
    result.type = "channelId";
    return result;
  }

  // 5. Иначе считаем, что это handle без @ (поддерживаем Unicode/кириллицу)
  if (raw.length > 0) {
    result.normalizedHandle = raw;
    result.type = "handle";
    return result;
  }

  // 6. Пустой или некорректный ввод
  return result;
}
