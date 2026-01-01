import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateProductCard } from '@/lib/ai-services/generation'
import { z } from 'zod'

// Схема валидации для request body
const generateCardSchema = z.object({
  productTitle: z.string().min(1, 'Название товара обязательно').max(500),
  productCategory: z.string().min(1, 'Категория товара обязательна').max(200),
  marketplace: z.enum(['ozon', 'wildberries']),
  style: z.enum(['selling', 'expert', 'brief']),
  additionalNotes: z.string().max(1000).optional(),
})

type GenerateCardRequest = z.infer<typeof generateCardSchema>

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Валидируем входные данные
    const validation = generateCardSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    const params: Parameters<typeof generateProductCard>[0] = {
      ...validation.data,
      userId: session.user.id,
    }

    // Вызываем сервис генерации
    const result = await generateProductCard(params)

    if (!result.success) {
      const statusCode = result.error.code === 'LIMIT_EXCEEDED' ? 429 : 500

      return NextResponse.json(
        {
          error: result.error.message,
          code: result.error.code,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('[POST /api/generate-card] Ошибка:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка при генерации',
      },
      { status: 500 }
    )
  }
}
