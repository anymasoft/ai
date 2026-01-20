/**
 * Slot Parser - извлекает и парсит data-slot маркеры из JSX кода
 * Используется для template_filling и fragment_editing режимов
 */

/**
 * Парсит слоты из JSX кода шаблона
 * Вытаскивает только элементы с data-slot="..." маркерами
 *
 * @param {string} templateCode - JSX код шаблона
 * @returns {Array} Массив объектов слотов с метаданными
 */
export function extractSlots(templateCode) {
  const slots = [];

  // Регулярное выражение для поиска элементов с data-slot
  // Ищем: <tag ... data-slot="ID" ... data-max-length="NUM" ... data-context="CTX" ... >...CONTENT...</tag>
  const slotPattern = /(<\w+[^>]*data-slot="([^"]+)"[^>]*(?:data-max-length="([^"]+)")?[^>]*(?:data-context="([^"]+)")?[^>]*>)([\s\S]*?)(<\/\w+>)/g;

  let match;
  while ((match = slotPattern.exec(templateCode)) !== null) {
    const [fullMatch, openTag, slotId, maxLength, context, content, closeTag] = match;

    // Извлекаем текущий текст слота (без JSX выражений)
    const textContent = extractTextContent(content);

    slots.push({
      id: slotId,
      location: `offset:${match.index}`,
      maxLength: maxLength ? parseInt(maxLength) : null,
      context: context || 'general',
      currentContent: textContent.trim(),
      fullMatch: fullMatch
    });
  }

  return slots;
}

/**
 * Парсит только маркеры слотов (для fragment_editing режима)
 * Не вытаскивает содержимое, только информацию о существовании слотов
 *
 * @param {string} componentCode - JSX код компонента
 * @returns {Array} Массив ID слотов, которые есть в компоненте
 */
export function extractSlotMarkers(componentCode) {
  const markers = [];

  // Ищем все data-slot="..." маркеры
  const markerPattern = /data-slot="([^"]+)"/g;

  let match;
  while ((match = markerPattern.exec(componentCode)) !== null) {
    const slotId = match[1];
    if (!markers.includes(slotId)) {
      markers.push(slotId);
    }
  }

  return markers;
}

/**
 * Извлекает текстовое содержимое, игнорируя JSX выражения
 * Преобразует {variable} в текст
 *
 * @param {string} content - JSX содержимое
 * @returns {string} Очищенный текст
 */
function extractTextContent(content) {
  // Удаляем JSX выражения {..}
  return content
    .replace(/{[^}]+}/g, '[content]')
    .replace(/<[^>]+>/g, '')  // Удаляем вложенные теги
    .trim();
}

/**
 * Проверяет целостность слотов
 * Используется в fragment_editing для убедиться что слоты не удалены
 *
 * @param {Array} originalMarkers - Оригинальные маркеры
 * @param {Array} updatedMarkers - Маркеры после редактирования
 * @returns {Object} { isValid, removedSlots, newSlots }
 */
export function validateSlotIntegrity(originalMarkers, updatedMarkers) {
  const removedSlots = originalMarkers.filter(m => !updatedMarkers.includes(m));
  const newSlots = updatedMarkers.filter(m => !originalMarkers.includes(m));

  return {
    isValid: removedSlots.length === 0 && newSlots.length === 0,
    removedSlots,
    newSlots,
    message:
      removedSlots.length > 0 ? `❌ Removed slots: ${removedSlots.join(', ')}` :
      newSlots.length > 0 ? `⚠️  Added slots: ${newSlots.join(', ')}` :
      '✅ Slots integrity preserved'
  };
}

/**
 * Определяет режим на основе контекста запроса
 *
 * @param {string} targetFile - Путь к файлу
 * @param {Object} files - Объект всех файлов проекта
 * @param {number} conversationTurn - Номер очереди в конверсации
 * @returns {string} 'template_filling' или 'fragment_editing'
 */
export function detectMode(targetFile, files, conversationTurn = 1) {
  // Если первый вызов (conversationTurn === 1), проверяем есть ли слоты
  if (conversationTurn === 1) {
    const fileContent = files[targetFile];
    if (!fileContent) return 'fragment_editing';

    const code = typeof fileContent === 'string' ? fileContent : fileContent.code;
    const markers = extractSlotMarkers(code);

    // Если есть data-slot маркеры → это шаблон → template_filling
    if (markers.length > 0) {
      return 'template_filling';
    }
  }

  // По умолчанию → fragment_editing
  return 'fragment_editing';
}
