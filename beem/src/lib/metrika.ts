/**
 * Утилита для трекинга событий Яндекс.Метрики
 * ID счётчика: 106161271
 */

interface GoalParams {
  [key: string]: string | number | boolean
}

/**
 * Отправить событие в Яндекс.Метрику
 * @param goalName - название события (например: 'free_submit', 'payment_success')
 * @param params - параметры события (необязательно)
 */
export function trackGoal(goalName: string, params?: GoalParams): void {
  // Проверка что окно и ym доступны
  if (typeof window === 'undefined') return

  const ym = (window as any).ym
  if (!ym || typeof ym !== 'function') {
    console.warn(`[Метрика] window.ym не доступна для события: ${goalName}`)
    return
  }

  try {
    // Если параметры передали - отправляем с параметрами
    if (params) {
      ym(106161271, 'reachGoal', goalName, params)
      console.log(`[Метрика] Событие отправлено: ${goalName}`, params)
    } else {
      // Без параметров
      ym(106161271, 'reachGoal', goalName)
      console.log(`[Метрика] Событие отправлено: ${goalName}`)
    }
  } catch (error) {
    console.error(`[Метрика] Ошибка при отправке события ${goalName}:`, error)
  }
}

/**
 * Типы событий для воронки конверсии
 */
export const METRIKA_EVENTS = {
  // Бесплатная валидация на лендинге
  FREE_SUBMIT: 'free_submit',
  FREE_RESULT_FAIL: 'free_result_fail',
  FREE_RESULT_PASS: 'free_result_pass',

  // Взаимодействие с CTA
  CTA_FAIL_GET_FULL: 'cta_fail_get_full',

  // Виды и интеракции
  PRICING_VIEW: 'pricing_view',

  // Авторизация
  SIGNIN_SUCCESS: 'signin_success',

  // Платежи
  PAYMENT_START: 'payment_start',
  PAYMENT_SUCCESS: 'payment_success',
} as const
