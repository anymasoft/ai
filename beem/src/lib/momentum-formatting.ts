/**
 * Утилиты для форматирования momentum score
 *
 * ВАЖНО: momentumScore рассчитывается как:
 *   momentumScore = (viewsPerDay / medianViewsPerDay) - 1
 *
 * Это означает:
 *   - momentumScore = 0    → видео растёт на уровне медианы
 *   - momentumScore = 0.5  → видео растёт на 50% быстрее медианы
 *   - momentumScore = 1    → видео растёт в 2 раза быстрее медианы (100%)
 *   - momentumScore = 10   → видео растёт в 11 раз быстрее медианы (1000%)
 *   - momentumScore = -0.5 → видео растёт на 50% медленнее медианы
 */

// Максимальное отображаемое значение процента (clamp)
const MAX_DISPLAY_PERCENT = 9999;
// Минимальное отображаемое значение процента
const MIN_DISPLAY_PERCENT = -99;

/**
 * Форматирует momentum score в человекочитаемый процент
 *
 * @param momentumScore - значение momentum (ratio - 1)
 * @returns строка вида "+123%" или "-45%" или "N/A"
 */
export function formatMomentumPercent(momentumScore: number | null | undefined): string {
  // Защита от невалидных значений
  if (momentumScore === null || momentumScore === undefined || !Number.isFinite(momentumScore)) {
    return "N/A";
  }

  // Конвертируем ratio в процент
  // momentumScore = 0.5 → 50%
  // momentumScore = 1 → 100%
  // momentumScore = 10 → 1000%
  const percentage = momentumScore * 100;

  // Clamp к разумным пределам чтобы избежать абсурда типа +1136377%
  const clampedPercent = Math.max(MIN_DISPLAY_PERCENT, Math.min(percentage, MAX_DISPLAY_PERCENT));

  // Округляем до целого
  const rounded = Math.round(clampedPercent);

  // Форматируем со знаком
  const sign = rounded > 0 ? "+" : "";

  // Если значение было обрезано — показываем с индикатором
  if (percentage > MAX_DISPLAY_PERCENT) {
    return `>${MAX_DISPLAY_PERCENT}%`;
  }

  return `${sign}${rounded}%`;
}

/**
 * Рассчитывает momentum score из viewsPerDay и медианы
 * С защитой от деления на ноль и edge cases
 *
 * @param viewsPerDay - просмотры в день для конкретного видео
 * @param medianViewsPerDay - медиана просмотров в день по всем видео
 * @returns momentum score или null если невозможно рассчитать
 */
export function calculateMomentumScore(
  viewsPerDay: number,
  medianViewsPerDay: number
): number | null {
  // Защита от невалидных входных данных
  if (!Number.isFinite(viewsPerDay) || !Number.isFinite(medianViewsPerDay)) {
    return null;
  }

  // Защита от деления на ноль или очень маленькую медиану
  if (medianViewsPerDay <= 0) {
    return null;
  }

  // Если медиана слишком маленькая (< 1 просмотр в день),
  // это может дать искажённые результаты
  // Но мы всё равно рассчитываем — просто clamp при отображении
  const ratio = viewsPerDay / medianViewsPerDay;
  const score = ratio - 1;

  return score;
}

/**
 * Определяет категорию momentum на основе score
 *
 * @param momentumScore - значение momentum
 * @returns категория: "High Momentum" | "Rising" | "Normal" | "Underperforming"
 */
export function getMomentumCategory(
  momentumScore: number | null | undefined
): "High Momentum" | "Rising" | "Normal" | "Underperforming" {
  if (momentumScore === null || momentumScore === undefined) {
    return "Normal";
  }

  if (momentumScore > 0.5) {
    return "High Momentum";
  } else if (momentumScore > 0.1) {
    return "Rising";
  } else if (momentumScore < -0.3) {
    return "Underperforming";
  }

  return "Normal";
}
