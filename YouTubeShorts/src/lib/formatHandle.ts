export function formatChannelHandle(item: {
  handle?: string | null
  channelHandle?: string | null
  customUrl?: string | null
  url?: string | null
  title?: string | null
}) {
  // Всегда отображаем title, если он есть
  if (item.title) return item.title;

  // Если handle начинается с @, возвращаем его
  if (item.handle && item.handle.startsWith("@")) return item.handle;

  // Если channelHandle начинается с @, возвращаем его
  if (item.channelHandle && item.channelHandle.startsWith("@")) return item.channelHandle;

  // Если channelHandle является URL, пытаемся извлечь handle
  if (item.channelHandle) {
    if (item.channelHandle.includes("youtube.com") || item.channelHandle.includes("http")) {
      const handleFromUrl = extractHandleFromUrl(item.channelHandle);
      if (handleFromUrl) return handleFromUrl;
      // Если не удалось извлечь handle, возвращаем оригинальный URL
      return item.channelHandle;
    }
    // Если channelHandle не URL, но и не начинается с @, возвращаем как есть
    return item.channelHandle;
  }

  // Обрабатываем customUrl
  if (item.customUrl) {
    const handleFromUrl = extractHandleFromUrl(item.customUrl);
    if (handleFromUrl) return handleFromUrl;
    return item.customUrl;
  }

  // Обрабатываем url
  if (item.url) {
    const handleFromUrl = extractHandleFromUrl(item.url);
    if (handleFromUrl) return handleFromUrl;
    return item.url;
  }

  // Если ничего нет, возвращаем пустую строку
  return "";
}

export function extractHandleFromUrl(url: string): string | null {
  try {
    const parts = url.split("/");
    const lastPart = parts[parts.length - 1];

    // Если последняя часть не пустая и не содержит "youtube.com" или "http"
    if (lastPart && !lastPart.includes("youtube.com") && !lastPart.includes("http")) {
      // Проверяем, начинается ли уже с @
      if (lastPart.startsWith("@")) {
        return lastPart;
      }
      // Добавляем @ если это похоже на handle (не пустая строка)
      return `@${lastPart}`;
    }

    // Если URL это полный URL, но мы не смогли извлечь handle
    // Пробуем найти часть после последнего /
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && part.trim() && !part.includes("youtube.com") && !part.includes("http") && !part.includes("www.")) {
        if (part.startsWith("@")) {
          return part;
        }
        return `@${part}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}
