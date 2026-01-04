import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { correctProductDescription, type ValidationIssue } from '@/lib/ai-services/validation'
import { z } from 'zod'

// Схема валидации для request body
const correctTextSchema = z.object({
  text: z.string().trim().min(1, 'Текст обязателен').max(5000),
  marketplace: z.enum(['ozon', 'wb']),
  issues: z.array(
    z.object({
      message: z.string(),
      suggestion: z.string().optional(),
      severity: z.enum(['error', 'warning', 'info']),
      type: z.string(),
    })
  ),
})

type CorrectTextRequest = z.infer<typeof correctTextSchema>

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Валидируем входные данные
    const validation = correctTextSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Вызываем сервис исправления
    const result = await correctProductDescription({
      description: validation.data.text,
      marketplace: validation.data.marketplace,
      issues: validation.data.issues as ValidationIssue[],
    })

    // Если была ошибка при исправлении
    if (!result.success && result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      )
    }

    // Успешный результат (даже если изменений не было)
    return NextResponse.json({
      success: result.success,
      data: result.data,
    })
  } catch (error) {
    console.error('[POST /api/correct-text] Ошибка:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка при исправлении',
      },
      { status: 500 }
    )
  }
}
