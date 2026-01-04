import { NextRequest, NextResponse } from 'next/server'
import { validateProductDescription } from '@/lib/ai-services/validation'
import { z } from 'zod'

// Схема валидации для request body (public, без авторизации)
const validateTextFreeSchema = z.object({
  text: z.string().trim().min(1, 'Текст обязателен').max(5000),
  marketplace: z.enum(['ozon', 'wb']),
})

type ValidateTextFreeRequest = z.infer<typeof validateTextFreeSchema>

/**
 * Public endpoint для бесплатной проверки описания товара.
 * Возвращает только summary (OK/NOT OK), без деталей ошибок.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[validate-text/free] raw body:', body)

    // Валидируем входные данные
    const validation = validateTextFreeSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Вызываем сервис валидации
    const result = await validateProductDescription({
      description: validation.data.text,
      marketplace: validation.data.marketplace,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      )
    }

    // Сжимаем результат для free версии: только summary
    const data = result.data
    const issuesByType = data.issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = 0
      acc[issue.type]++
      return acc
    }, {} as Record<string, number>)

    const categories = Object.keys(issuesByType)

    return NextResponse.json({
      success: true,
      data: {
        ok: data.isValid,
        issueCount: data.issues.length,
        score: data.score,
        categories: categories,
        summary: data.summary,
      },
    })
  } catch (error) {
    console.error('[POST /api/validate-text/free] Ошибка:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка при валидации',
      },
      { status: 500 }
    )
  }
}
