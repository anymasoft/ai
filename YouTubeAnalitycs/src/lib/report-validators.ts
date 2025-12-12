/**
 * Валидаторы для PDF отчетов - проверка что контент только на английском
 */

/**
 * Проверяет содержит ли строка кириллицу
 */
export function containsCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text)
}

/**
 * Рекурсивно проверяет все строки в JSON объекте/массиве на наличие кириллицы
 */
export function jsonContainsCyrillic(obj: unknown): boolean {
  if (typeof obj === 'string') {
    return containsCyrillic(obj)
  }

  if (Array.isArray(obj)) {
    return obj.some(item => jsonContainsCyrillic(item))
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj).some(value => jsonContainsCyrillic(value))
  }

  return false
}

/**
 * Проверяет что JSON содержит только ASCII символы (для дополнительной безопасности)
 */
export function jsonOnlyASCII(obj: unknown): boolean {
  const json = JSON.stringify(obj)
  // ASCII: 0-127, но разрешаем 32-126 (печатные символы) плюс \n, \r, \t
  return /^[\x20-\x7E\n\r\t]*$/.test(json)
}
