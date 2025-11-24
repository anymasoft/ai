/**
 * Утилиты для работы с YouTube API
 */

/**
 * Генерирует случайную версию клиента из последних 30 дней
 * @returns {string} Версия вида "2.20241123.00.00"
 */
export function generateRandomClientVersion() {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0].replace(/-/g, "");
  });

  const randomDate = dates[Math.floor(Math.random() * dates.length)];
  return `2.${randomDate}.00.00`;
}

/**
 * Создает контекст для YouTube API запросов
 * @param {string} clientName - Имя клиента (по умолчанию "WEB")
 * @returns {Object} Контекст для API
 */
export function createYouTubeContext(clientName = "WEB") {
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

/**
 * Очищает текст субтитра от HTML тегов и entities
 * @param {string} text - Сырой текст
 * @returns {string} Очищенный текст
 */
export function cleanText(text) {
  if (!text) return "";

  // 1. Удаляем HTML теги
  text = text.replace(/<[^>]*>/g, "");

  // 2. Декодируем HTML entities
  text = decodeHtmlEntities(text);

  // 3. Удаляем лишние пробелы
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Декодирует HTML entities
 * @param {string} text - Текст с entities
 * @returns {string} Декодированный текст
 */
export function decodeHtmlEntities(text) {
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

  return text.replace(/&#\d+;|&\w+;/g, entity => {
    return entities[entity] || entity;
  });
}

/**
 * Форматирует время в читаемый вид
 * @param {number} seconds - Секунды
 * @returns {string} Форматированное время "MM:SS" или "HH:MM:SS"
 */
export function formatTime(seconds) {
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

/**
 * Парсит XML субтитров
 * @param {string} xmlText - XML текст
 * @returns {Document} Parsed XML document
 */
export function parseXML(xmlText) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlText, "text/xml");
}

/**
 * Получает HTML страницы YouTube видео
 * @param {string} videoId - ID видео
 * @returns {Promise<string>} HTML код
 */
export async function fetchYouTubePageHtml(videoId) {
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

/**
 * Логирует с префиксом модуля
 * @param {string} module - Имя модуля
 * @param {...any} args - Аргументы для логирования
 */
export function log(module, ...args) {
  console.log(`[YT-Transcript:${module}]`, ...args);
}

/**
 * Логирует ошибку с префиксом модуля
 * @param {string} module - Имя модуля
 * @param {...any} args - Аргументы для логирования
 */
export function logError(module, ...args) {
  console.error(`[YT-Transcript:${module}]`, ...args);
}
