/**
 * Утилиты для единообразного форматирования дат публикации видео
 *
 * ВАЖНО: Все функции используют ТОЛЬКО поле publishDate (string | null)
 * Никаких fallback'ов на текущую дату, никаких относительных дат
 */

/**
 * Форматирует дату в стандартный вид (абсолютная дата)
 * Формат: "8 декабря 2024" (для русского) или "December 8, 2024" (для английского)
 */
export function formatPublishedDate(dateString: string | null, locale: "ru" | "en" = "ru"): string {
  if (!dateString) {
    return locale === "ru" ? "Дата неизвестна" : "Date unknown";
  }

  try {
    const date = new Date(dateString);

    // Проверка на валидность даты
    if (isNaN(date.getTime())) {
      return locale === "ru" ? "Дата неизвестна" : "Date unknown";
    }

    // Используем toLocaleDateString с явным указанием locale
    // Это избегает timezone shift'а
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC", // Явно используем UTC чтобы избежать сдвига часовой зоны
    };

    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", options);
  } catch (error) {
    return locale === "ru" ? "Дата неизвестна" : "Date unknown";
  }
}

/**
 * Компактный формат даты для таблиц (например, "8 дек 2024")
 */
export function formatPublishedDateCompact(
  dateString: string | null,
  locale: "ru" | "en" = "ru"
): string {
  if (!dateString) {
    return "—";
  }

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return "—";
    }

    const options: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    };

    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", options);
  } catch (error) {
    return "—";
  }
}

/**
 * Только месяц и год (для фильтров, группировки и т.д.)
 */
export function formatPublishedMonthYear(
  dateString: string | null,
  locale: "ru" | "en" = "ru"
): string {
  if (!dateString) {
    return locale === "ru" ? "Неизвестно" : "Unknown";
  }

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return locale === "ru" ? "Неизвестно" : "Unknown";
    }

    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    };

    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", options);
  } catch (error) {
    return locale === "ru" ? "Неизвестно" : "Unknown";
  }
}

/**
 * ISO строка без времени (для логирования и сравнения)
 */
export function getPublishedDateISO(dateString: string | null): string | null {
  if (!dateString) {
    return null;
  }

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return null;
    }

    // Возвращаем дату в ISO 8601 формате без времени
    return date.toISOString().split("T")[0];
  } catch (error) {
    return null;
  }
}

/**
 * Проверяет, является ли дата валидной и не в будущем
 */
export function isValidPublishedDate(dateString: string | null): boolean {
  if (!dateString) {
    return false;
  }

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return false;
    }

    // Дата не должна быть в будущем
    const now = new Date();
    if (date > now) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
