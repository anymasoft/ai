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
  keywords?: string[]
  explanation?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  generatedAt?: string
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
 * Парсить ответ OpenAI и извлечь структурированные поля
 * Ожидается формат:
 * Заголовок: ...
 * Описание: ...
 * Ключевые слова: ...
 * Пояснение: ...
 */
const parseGenerationResponse = (text: string): {
  title: string
  description: string
  keywords?: string[]
  explanation?: string
} => {
  // Регулярные выражения для поиска секций
  const titleMatch = text.match(/(?:Заголовок|Название)[\s:]*([^\n]+(?:\n(?!(?:Описание|Ключевые|Пояснение))[^\n]+)*)/i)
  const descriptionMatch = text.match(/(?:Описание|Основное описание)[\s:]*([^\n]+(?:\n(?!(?:Ключевые|Пояснение|Объяснение))[^\n]+)*)/i)
  const keywordsMatch = text.match(/(?:Ключевые слова|SEO-ключи)[\s:]*([^\n]+(?:\n(?!(?:Пояснение|Объяснение))[^\n]+)*)/i)
  const explanationMatch = text.match(/(?:Пояснение|Почему это работает|Объяснение)[\s:]*([^\n]+(?:\n[^\n]+)*)/i)

  // Извлекаем и очищаем заголовок
  const title = titleMatch?.[1]?.trim() || 'Сгенерированная карточка'

  // Извлекаем и очищаем описание
  const description = descriptionMatch?.[1]?.trim() || text

  // Парсим ключевые слова из списка или CSV
  let keywords: string[] | undefined
  if (keywordsMatch) {
    const keywordsText = keywordsMatch[1]
    keywords = keywordsText
      .split(/[,\n-]/g)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && !k.match(/^[•*]/))
      .slice(0, 10) // максимум 10 ключевых слов
  }

  // Извлекаем пояснение
  const explanation = explanationMatch?.[1]?.trim()

  return {
    title,
    description,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
    explanation: explanation && explanation.length > 10 ? explanation : undefined,
  }
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
  marketplace: 'ozon' | 'wb'
  style: 'selling' | 'expert' | 'brief'
  seoKeywords?: string[]
  competitors?: string[]
  additionalNotes?: string
  userId?: string
}): Promise<{ success: true; data: GeneratedProductCard } | { success: false; error: GenerationError }> => {
  try {
    const {
      productTitle,
      productCategory,
      marketplace,
      style,
      seoKeywords,
      competitors,
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

    // Проверяем пакет пользователя если передан userId
    if (userId) {
      const userResult = await db.execute(
        'SELECT total_generations, used_generations FROM users WHERE id = ?',
        [userId]
      )
      const rows = Array.isArray(userResult) ? userResult : userResult.rows || []
      if (rows.length === 0) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Пользователь не найден',
          },
        }
      }

      const user = rows[0] as any
      if (user.used_generations >= user.total_generations) {
        return {
          success: false,
          error: {
            code: 'PACKAGE_EXHAUSTED',
            message: 'Пакет генераций исчерпан',
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
      seoKeywords,
      competitors,
      additionalNotes: additionalNotes?.trim(),
    })

    // Вызываем OpenAI API (модель СТРОГО из OPENAI_MODEL)
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
      0.7,
      2000
    )

    // Парсим результат используя специальный парсер
    const parsed = parseGenerationResponse(response.content)

    const result: GeneratedProductCard = {
      title: parsed.title,
      description: parsed.description,
      keywords: parsed.keywords,
      explanation: parsed.explanation,
      usage: response.usage || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      generatedAt: new Date().toISOString(),
    }

    // Увеличиваем счётчик использования пакета если передан userId
    if (userId) {
      await db.execute(
        'UPDATE users SET used_generations = used_generations + 1, updatedAt = ? WHERE id = ?',
        [Math.floor(Date.now() / 1000), userId]
      )
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

