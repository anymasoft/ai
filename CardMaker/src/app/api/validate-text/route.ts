import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { validateProductDescription } from '@/lib/ai-services/validation'
import { z } from 'zod'

// Схема валидации для request body
const validateTextSchema = z.object({
  description: z.string().min(1, 'Описание обязательно').max(5000),
  marketplace: z.enum(['ozon', 'wildberries']),
})

type ValidateTextRequest = z.infer<typeof validateTextSchema>

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Валидируем входные данные
    const validation = validateTextSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Вызываем сервис валидации
    const result = await validateProductDescription({
      description: validation.data.description,
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

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('[POST /api/validate-text] Ошибка:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка при валидации',
      },
      { status: 500 }
    )
  }
}
