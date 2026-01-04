'use server'

import { callOpenAI } from '@/lib/openai-client'
import { buildValidationPrompt } from '@/lib/prompts/builders'

/**
 * Проблема, найденная при валидации
 * ТОЛЬКО 2 типа: запрещённые слова и нарушение правил маркетплейса
 */
export interface ValidationIssue {
  type: 'forbidden_words' | 'marketplace_rule'
  severity: 'error' | 'warning'
  message: string
  suggestion?: string
  text_fragment?: string // ДОБАВЛЕНО: проблемный фрагмент текста из описания
}

/**
 * Результат проверки (для детализации оценки)
 */
export interface CheckResult {
  id: string
  name: string
  weight: number
  passed: boolean
  penaltyApplied?: number
}

/**
 * Результат валидации описания
 */
export interface ValidationResult {
  isValid: boolean
  score: number // 0-100
  issues: ValidationIssue[]
  summary: string
  validatedAt: string
  marketplace: 'ozon' | 'wb' // ДОБАВЛЕНО: для проверки свежести данных
  configVersion: string // ДОБАВЛЕНО: версия конфига
  checks?: CheckResult[] // детализация по проверкам (опционально)
}

/**
 * Ошибка при валидации
 */
export interface ValidationError {
  code: string
  message: string
  details?: any
}

/**
 * ШАГ 1: ЕДИНЫЙ BACKEND-ENGINE ВАЛИДАЦИИ
 *
 * Основная функция валидации описаний товаров
 * - Используется для лендинга И /validate
 * - Детерминирована (temperature = 0)
 * - Возвращает: isValid (всегда) + детали (опционально)
 *
 * @param params.description Текст описания
 * @param params.marketplace Маркетплейс (ozon | wb)
 * @param params.mode Режим ответа: 'summary' (только isValid) или 'full' (все детали)
 * @returns Результат валидации или ошибка
 */
export const validateDescriptionWithRules = async (params: {
  description: string
  marketplace: 'ozon' | 'wb'
  mode?: 'summary' | 'full'
}): Promise<
  | { success: true; data: ValidationResult }
  | { success: false; error: ValidationError }
> => {
  try {
    const { description, marketplace, mode = 'full' } = params

    // Валидируем входные данные
    if (!description?.trim()) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Описание не может быть пустым',
        },
      }
    }

    // Строим ЕДИНЫЙ промпт на основе конфигурации из БД
    const { systemPrompt, userPrompt } = await buildValidationPrompt({
      description: description.trim(),
      marketplace,
    })

    // Вызываем OpenAI API с temperature = 0 для ДЕТЕРМИНИРОВАННОСТИ
    const response = await callOpenAI(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      undefined, // модель берётся из env
      0, // ✅ ТЕМПЕРАТУРА 0 - ДЕТЕРМИНИРОВАНА
      1500
    )

    // Парсим JSON ответ
    let validationData: any

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON не найден в ответе')
      }

      validationData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[validateDescriptionWithRules] Ошибка парсинга JSON:', parseError)

      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Не удалось распарсить ответ валидации',
          details: response.content,
        },
      }
    }

    // Нормализуем данные валидации (ТОЛЬКО 2 типа: forbidden_words и marketplace_rule)
    const issues: ValidationIssue[] = (validationData.violations || [])
      .map((violation: any) => ({
        type: violation.type || 'marketplace_rule',
        severity: violation.severity || 'error',
        message: violation.description || violation.message || 'Неизвестная проблема',
        suggestion: violation.suggestion,
        text_fragment: violation.text_fragment, // Проблемный фрагмент из описания
      }))
      .filter((issue: ValidationIssue) => issue.message)

    // Вычисляем скор
    const score = Math.max(0, Math.min(100, 100 - issues.length * 10))

    // ШАГ 3: В РЕЖИМЕ SUMMARY убираем детали issues
    const issuesForResponse = mode === 'summary' ? [] : issues

    // ШАГ 4: Формируем isValid на основе КРИТИЧЕСКИХ ошибок (severity === "error")
    // isValid === false ТОЛЬКО если есть хотя бы одна ошибка с severity === "error"
    // isValid === true, если нет критических ошибок (warnings не блокируют)
    const hasCriticalErrors = issues.some((i) => i.severity === 'error')

    const result: ValidationResult = {
      isValid: !hasCriticalErrors,
      score,
      issues: issuesForResponse, // ← В summary режиме пусто
      summary: issues.length === 0
        ? 'Описание соответствует всем требованиям'
        : `Найдено ${issues.length} нарушений`,
      validatedAt: new Date().toISOString(),
      marketplace,
      configVersion: '1.0.0', // TODO: читать из config
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('[validateDescriptionWithRules] Ошибка валидации:', error)

    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message:
          error instanceof Error ? error.message : 'Неизвестная ошибка при валидации',
        details: error instanceof Error ? error.stack : undefined,
      },
    }
  }
}

/**
 * LEGACY: Старая функция validateProductDescription (для совместимости)
 * ПРОСТО ВЫЗЫВАЕТ новую функцию validateDescriptionWithRules()
 */
export const validateProductDescription = async (params: {
  description: string
  marketplace: 'ozon' | 'wb'
}): Promise<
  | { success: true; data: ValidationResult }
  | { success: false; error: ValidationError }
> => {
  return validateDescriptionWithRules({
    description: params.description,
    marketplace: params.marketplace,
    mode: 'full',
  })
}

/**
 * Высчитать скор на основе найденных проблем
 */
const calculateScore = (issues: ValidationIssue[], isValid?: boolean): number => {
  if (issues.length === 0) {
    return 100
  }

  // Начинаем со 100 и вычитаем за каждую проблему
  let score = 100

  // Вычитаем в зависимости от severity
  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 20
        break
      case 'warning':
        score -= 10
        break
      case 'info':
        score -= 2
        break
    }
  }

  // Не допускаем отрицательные значения
  return Math.max(0, score)
}

/**
 * Сгенерировать сводку на основе найденных проблем
 */
const summarizeIssues = (issues: ValidationIssue[]): string => {
  if (issues.length === 0) {
    return 'Описание соответствует всем требованиям маркетплейса'
  }

  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  const parts: string[] = []

  if (errors.length > 0) {
    parts.push(`Найдено ${errors.length} критических проблем(ы)`)
  }

  if (warnings.length > 0) {
    parts.push(`Найдено ${warnings.length} предупреждения(я)`)
  }

  if (parts.length === 0) {
    return `Найдено ${issues.length} замечание(я) общего характера`
  }

  return parts.join('. ')
}

/**
 * Исправить описание товара на основе результатов валидации
 * Использует violations (без suggestions) для корректировки текста
 *
 * @param params Параметры для исправления
 * @returns Исправленный текст или ошибка
 */
export const correctProductDescription = async (params: {
  description: string
  marketplace: 'ozon' | 'wb'
  issues: ValidationIssue[]
}): Promise<
  | { success: true; data: { corrected: string; changesCount: number } }
  | { success: false; error: ValidationError }
> => {
  try {
    const { description, marketplace, issues } = params

    if (!description?.trim()) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Описание не может быть пустым',
        },
      }
    }

    // Если нет issues, нечего исправлять
    if (!issues || issues.length === 0) {
      return {
        success: true,
        data: {
          corrected: description,
          changesCount: 0,
        },
      }
    }

    // Форматируем violations (issues) в понятный для GPT список проблем
    const violationsText = issues
      .map((issue, i) => `${i + 1}. [${issue.type}] ${issue.message}`)
      .join('\n')

    const systemPrompt = `Ты помощник по улучшению описаний товаров для маркетплейса ${marketplace === 'ozon' ? 'Озон' : 'Wildberries'}.

Твоя задача: исправить описание товара, устранив выявленные проблемы.

Правила:
- Исправляй ТОЛЬКО выявленные проблемы из списка нарушений
- НЕ переписывай текст целиком
- НЕ изменяй значение или смысл
- Сохраняй структуру и стиль оригинального текста
- Удаляй или нейтрализуй запрещённые утверждения
- Возвращай только исправленный текст без объяснений`

    const userPrompt = `Исправь следующее описание товара, устраняя указанные нарушения:

Оригинальный текст:
"""${description}"""

Выявленные проблемы:
${violationsText}

Верни ТОЛЬКО исправленный текст, без пояснений.`

    const response = await callOpenAI(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      undefined,
      0.3, // Низкая температура для точности
      1500
    )

    const corrected = response.content.trim()

    // Проверяем, действительно ли текст изменился
    const originalTrimmed = description.trim()
    const correctedTrimmed = corrected.trim()
    const hasChanges = originalTrimmed !== correctedTrimmed && corrected.length > 0

    // Примерный подсчёт изменений на основе количества исправленных проблем
    const changesCount = hasChanges ? issues.length : 0

    return {
      success: true,
      data: {
        corrected: correctedTrimmed || originalTrimmed,
        changesCount,
      },
    }
  } catch (error) {
    console.error('[correctProductDescription] Ошибка исправления:', error)

    return {
      success: false,
      error: {
        code: 'CORRECTION_ERROR',
        message:
          error instanceof Error ? error.message : 'Неизвестная ошибка при исправлении',
        details: error instanceof Error ? error.stack : undefined,
      },
    }
  }
}
