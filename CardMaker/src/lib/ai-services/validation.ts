'use server'

import { callOpenAI } from '@/lib/openai-client'
import { buildValidationPrompt } from '@/lib/prompts/builders'

/**
 * Проблема, найденная при валидации
 */
export interface ValidationIssue {
  type:
    | 'forbidden_words'
    | 'grammar'
    | 'requirements'
    | 'exaggeration'
    | 'clarity'
    | 'other'
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
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
 * Валидировать описание товара используя OpenAI
 *
 * @param params Параметры для валидации
 * @returns Результат валидации или ошибка
 */
export const validateProductDescription = async (params: {
  description: string
  marketplace: 'ozon' | 'wildberries'
}): Promise<
  | { success: true; data: ValidationResult }
  | { success: false; error: ValidationError }
> => {
  try {
    const { description, marketplace } = params

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

    // Строим промпты на основе конфигурации из БД
    const { systemPrompt, userPrompt } = await buildValidationPrompt({
      description: description.trim(),
      marketplace,
    })

    // Вызываем OpenAI API для валидации
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
      'gpt-4o-mini',
      0.5, // Более низкая температура для консистентности JSON
      1500
    )

    // Парсим JSON ответ
    let validationData: any

    try {
      // Пытаемся найти JSON объект в ответе
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON не найден в ответе')
      }

      validationData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[validateProductDescription] Ошибка парсинга JSON:', parseError)

      // Если не удалось распарсить, возвращаем как ошибку парсинга
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Не удалось распарсить ответ валидации',
          details: response.content,
        },
      }
    }

    // Нормализуем данные валидации
    const issues: ValidationIssue[] = (validationData.issues || [])
      .map((issue: any) => ({
        type: issue.type || 'other',
        severity: issue.severity || 'warning',
        message: issue.message || 'Неизвестная проблема',
        suggestion: issue.suggestion,
      }))
      .filter((issue: ValidationIssue) => issue.message)

    // Высчитываем финальный скор если не передан
    const score =
      typeof validationData.score === 'number' && validationData.score >= 0 && validationData.score <= 100
        ? validationData.score
        : calculateScore(issues, validationData.isValid)

    const result: ValidationResult = {
      isValid: validationData.isValid === true,
      score,
      issues,
      summary: validationData.summary || summarizeIssues(issues),
      validatedAt: new Date().toISOString(),
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('[validateProductDescription] Ошибка валидации:', error)

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
