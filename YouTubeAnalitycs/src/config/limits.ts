/**
 * Конфигурация лимитов видео по тарифным планам
 *
 * Изменяйте эти значения для настройки ограничений.
 * Все компоненты используют этот единый источник истины.
 */

// Количество видео на одной "странице" (порция при загрузке)
export const VIDEO_PAGE_SIZE = 12;

// Максимальное количество видео по тарифам
export const TIER_VIDEO_LIMITS = {
  trial: 12,          // Только первая порция, без "Load more"
  basic: 12,          // Только первая порция, без "Load more"
  professional: 60,   // До 5 порций (12 × 5)
  enterprise: 150,    // До 12+ порций
} as const;

// Типы для TypeScript
export type UserPlan = keyof typeof TIER_VIDEO_LIMITS;

/**
 * Получает лимит видео для указанного плана
 */
export function getVideoLimitForPlan(plan: UserPlan): number {
  return TIER_VIDEO_LIMITS[plan] ?? TIER_VIDEO_LIMITS.trial;
}

/**
 * Проверяет, может ли пользователь загружать больше видео
 * (т.е. есть ли у него доступ к "Load more")
 */
export function canLoadMoreVideos(plan: UserPlan): boolean {
  const limit = getVideoLimitForPlan(plan);
  return limit > VIDEO_PAGE_SIZE;
}

/**
 * Рассчитывает максимальное количество страниц API для плана
 * (используется при синхронизации с ScrapeCreators)
 */
export function getMaxApiPagesForPlan(plan: UserPlan): number {
  const limit = getVideoLimitForPlan(plan);
  // ScrapeCreators возвращает ~30 видео на страницу
  // Добавляем +1 страницу для запаса
  return Math.ceil(limit / 30) + 1;
}
