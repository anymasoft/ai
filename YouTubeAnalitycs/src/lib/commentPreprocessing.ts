/**
 * Утилиты для предобработки текста комментариев перед AI-анализом
 */

/**
 * Удаляет URL и ссылки из текста
 */
function removeUrls(text: string): string {
  // Удаляем HTTP/HTTPS ссылки
  text = text.replace(/https?:\/\/[^\s]+/gi, '');

  // Удаляем www. ссылки
  text = text.replace(/www\.[^\s]+/gi, '');

  // Удаляем упоминания youtube.com и youtu.be
  text = text.replace(/(?:youtube\.com|youtu\.be)\/[^\s]*/gi, '');

  return text;
}

/**
 * Удаляет emoji из текста
 */
function removeEmojis(text: string): string {
  // Удаляем emoji используя Unicode диапазоны
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}-\u{1F0CF}]|[\u{1F170}-\u{1F251}]/gu, '');
}

/**
 * Удаляет специальные символы и мусор
 */
function removeSpecialChars(text: string): string {
  // Удаляем избыточные специальные символы, оставляя только базовую пунктуацию
  text = text.replace(/[#@$%^&*()_+=\[\]{}<>|\\]/g, '');

  // Удаляем повторяющиеся знаки препинания
  text = text.replace(/([!?.]){2,}/g, '$1');

  return text;
}

/**
 * Нормализует пробелы и переносы строк
 */
function normalizeWhitespace(text: string): string {
  // Заменяем множественные пробелы на один
  text = text.replace(/\s+/g, ' ');

  // Убираем пробелы в начале и конце
  text = text.trim();

  return text;
}

/**
 * Удаляет timestamp метки (например: 00:12, 1:23:45)
 */
function removeTimestamps(text: string): string {
  // Удаляем временные метки в форматах: MM:SS, HH:MM:SS, H:MM:SS
  return text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
}

/**
 * Удаляет повторяющиеся символы (например: !!!!!!, ????????)
 */
function removeRepeatedChars(text: string): string {
  // Оставляем максимум 2 повторяющихся символа
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * Основная функция предобработки комментариев для AI-анализа
 *
 * @param text - исходный текст комментария
 * @returns очищенный текст
 */
export function prepareCommentForAI(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // Применяем все очистки последовательно
  cleaned = removeUrls(cleaned);
  cleaned = removeEmojis(cleaned);
  cleaned = removeTimestamps(cleaned);
  cleaned = removeSpecialChars(cleaned);
  cleaned = removeRepeatedChars(cleaned);
  cleaned = normalizeWhitespace(cleaned);

  return cleaned;
}

/**
 * Обрабатывает массив комментариев для AI-анализа
 *
 * @param comments - массив объектов комментариев с полем content
 * @returns массив объектов с очищенным текстом
 */
export function prepareCommentsForAI<T extends { content: string }>(
  comments: T[]
): Array<T & { cleanedContent: string }> {
  return comments.map((comment) => ({
    ...comment,
    cleanedContent: prepareCommentForAI(comment.content),
  }));
}

/**
 * Извлекает только непустые очищенные тексты комментариев
 *
 * @param comments - массив объектов комментариев с полем content
 * @param minLength - минимальная длина комментария (по умолчанию 3 символа)
 * @returns массив очищенных текстов
 */
export function extractCleanedTexts(
  comments: Array<{ content: string }>,
  minLength: number = 3
): string[] {
  return comments
    .map((comment) => prepareCommentForAI(comment.content))
    .filter((text) => text.length >= minLength);
}
