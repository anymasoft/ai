'use server'

import { callOpenAI } from '@/lib/openai-client'
import { buildGenerationPrompt } from '@/lib/prompts/builders'
import { db } from '@/lib/db'

/**
 * Результат генерации описания товара
 */
export interface GeneratedProductCard {
  title: string
  description: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  generatedAt: string
}

/**
 * Ошибка при генерации
 */
export interface GenerationError {
  code: string
  message: string
  details?: any
}

/**
 * Генерировать описание товара используя OpenAI
 *
 * @param params Параметры для генерации
 * @returns Сгенерированное описание или ошибка
 */
export const generateProductCard = async (params: {
  productTitle: string
  productCategory: string
  marketplace: 'ozon' | 'wildberries'
  style: 'selling' | 'expert' | 'brief'
  additionalNotes?: string
  userId?: string
}): Promise<{ success: true; data: GeneratedProductCard } | { success: false; error: GenerationError }> => {
  try {
    const {
      productTitle,
      productCategory,
      marketplace,
      style,
      additionalNotes,
      userId,
    } = params

    // Валидируем входные данные
    if (!productTitle?.trim()) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Название товара не может быть пустым',
        },
      }
    }

    if (!productCategory?.trim()) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Категория товара не может быть пустой',
        },
      }
    }

    // Проверяем лимиты пользователя если передан userId
    if (userId) {
      const canGenerate = await checkUserGenerationLimit(userId)
      if (!canGenerate) {
        return {
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: 'Превышен месячный лимит генераций',
          },
        }
      }
    }

    // Строим промпты на основе конфигурации из БД
    const { systemPrompt, userPrompt } = await buildGenerationPrompt({
      productTitle: productTitle.trim(),
      productCategory: productCategory.trim(),
      marketplace,
      style,
      additionalNotes: additionalNotes?.trim(),
    })

    // Вызываем OpenAI API
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
      0.7,
      2000
    )

    // Парсим результат
    const lines = response.content.trim().split('\n')
    const emptyLineIndex = lines.findIndex((line) => !line.trim())

    const title = lines
      .slice(0, emptyLineIndex === -1 ? 1 : emptyLineIndex)
      .join('\n')
      .trim()

    const description = lines
      .slice(emptyLineIndex === -1 ? 1 : emptyLineIndex + 1)
      .join('\n')
      .trim()

    // Если не удалось разделить на два блока, используем весь текст как описание
    const finalTitle = title || `Описание товара: ${productTitle}`
    const finalDescription = description || response.content

    const result: GeneratedProductCard = {
      title: finalTitle,
      description: finalDescription,
      usage: response.usage || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      generatedAt: new Date().toISOString(),
    }

    // Логируем использование если передан userId
    if (userId) {
      await logGenerationUsage(userId, response.usage?.totalTokens || 0)
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('[generateProductCard] Ошибка генерации:', error)

    return {
      success: false,
      error: {
        code: 'GENERATION_ERROR',
        message:
          error instanceof Error ? error.message : 'Неизвестная ошибка при генерации',
        details: error instanceof Error ? error.stack : undefined,
      },
    }
  }
}

/**
 * Проверить, есть ли у пользователя лимит для генерации
 * (интеграция с системой лимитов)
 */
const checkUserGenerationLimit = async (userId: string): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Получаем пользователя и его тариф
    const userResult = await db.execute(
      'SELECT plan FROM users WHERE id = ? LIMIT 1',
      [userId]
    )

    const userRows = Array.isArray(userResult) ? userResult : userResult.rows || []

    if (userRows.length === 0) {
      return false
    }

    const plan = userRows[0].plan || 'free'

    // Определяем лимит на основе тарифа
    const limits: Record<string, number> = {
      free: 5,
      basic: 20,
      professional: 100,
      enterprise: 1000,
      pro: 100,
      business: 500,
    }

    const dailyLimit = limits[plan] || 0

    // Получаем текущее использование за день
    const usageResult = await db.execute(
      `SELECT COALESCE(SUM(cardsUsed), 0) as totalUsed FROM user_usage_daily
       WHERE userId = ? AND day = ?`,
      [userId, today]
    )

    const usageRows = Array.isArray(usageResult) ? usageResult : usageResult.rows || []
    const currentUsage = usageRows[0]?.totalUsed || 0

    return currentUsage < dailyLimit
  } catch (error) {
    console.error('[checkUserGenerationLimit] Ошибка проверки лимита:', error)
    // На случай ошибки разрешаем генерацию
    return true
  }
}

/**
 * Логировать использование генерации для пользователя
 */
const logGenerationUsage = async (userId: string, tokens: number): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Проверяем есть ли уже запись за сегодня
    const existingResult = await db.execute(
      'SELECT id, cardsUsed FROM user_usage_daily WHERE userId = ? AND day = ? LIMIT 1',
      [userId, today]
    )

    const existingRows = Array.isArray(existingResult)
      ? existingResult
      : existingResult.rows || []

    if (existingRows.length > 0) {
      // Обновляем существующую запись
      const currentCards = existingRows[0].cardsUsed || 0
      await db.execute(
        'UPDATE user_usage_daily SET cardsUsed = cardsUsed + 1, updatedAt = ? WHERE userId = ? AND day = ?',
        [Math.floor(Date.now() / 1000), userId, today]
      )
    } else {
      // Создаём новую запись
      await db.execute(
        'INSERT INTO user_usage_daily (userId, day, cardsUsed, updatedAt) VALUES (?, ?, 1, ?)',
        [userId, today, Math.floor(Date.now() / 1000)]
      )
    }
  } catch (error) {
    console.error('[logGenerationUsage] Ошибка логирования:', error)
    // Ошибка логирования не должна прерывать основной процесс
  }
}
