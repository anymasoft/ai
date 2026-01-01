import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateProductCard } from '@/lib/ai-services/generation'
import { z } from 'zod'

// Схема валидации для request body
// ВАЖНО: соответствует реальному body из UI (card-generator/page.tsx)
const generateCardSchema = z.object({
  productDescription: z.string().min(1, 'Описание товара обязательно').max(5000),
  marketplace: z.enum(['ozon', 'wildberries']),
  category: z.string().min(1, 'Категория товара обязательна').max(200),
  style: z.enum(['selling', 'expert', 'brief']).default('selling'),
  seoKeywords: z.array(z.string()).optional().default([]),
  competitors: z.array(z.string()).optional().default([]),
})

type GenerateCardRequest = z.infer<typeof generateCardSchema>

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  try {
    const body = await request.json()
    console.log('[generate-card] raw body:', body)

    // Валидируем входные данные
    const validation = generateCardSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Преобразуем данные из UI формата в формат сервиса
    const params: Parameters<typeof generateProductCard>[0] = {
      productTitle: validation.data.productDescription,
      productCategory: validation.data.category,
      marketplace: validation.data.marketplace,
      style: validation.data.style as 'selling' | 'expert' | 'brief',
      seoKeywords: validation.data.seoKeywords,
      competitors: validation.data.competitors,
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
