import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { generateProductCard } from '@/lib/ai-services/generation'

// Схема валидации для request body
const generateCardSchema = z.object({
  productDescription: z.string().min(1, 'Описание товара обязательно').max(5000),
  marketplace: z.enum(['ozon', 'wb']),
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

    // Валидируем входные данные
    const validation = generateCardSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Синхронно вызываем генерацию
    const result = await generateProductCard({
      productTitle: validation.data.productDescription,
      productCategory: validation.data.category,
      marketplace: validation.data.marketplace,
      style: validation.data.style,
      seoKeywords: validation.data.seoKeywords,
      competitors: validation.data.competitors,
      userId: session.user.id,
    })

    // Возвращаем результат сразу
    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    )
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
