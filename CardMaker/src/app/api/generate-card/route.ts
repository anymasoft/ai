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
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // Валидируем входные данные
    const validation = generateCardSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: `Ошибка валидации: ${errors.join(', ')}` } },
        { status: 400 }
      )
    }

    // Логируем начало генерации
    console.info('[generate-card] starting', {
      userId: session.user.id,
      marketplace: validation.data.marketplace,
      style: validation.data.style,
    })

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

    // ✅ КРИТИЧЕСКАЯ ПРОВЕРКА: result.success
    if (!result.success) {
      const statusCode =
        result.error.code === 'LIMIT_EXCEEDED' ? 429 :
        result.error.code === 'INVALID_INPUT' ? 400 :
        500

      console.info('[generate-card] generation failed', {
        code: result.error.code,
        message: result.error.message,
        status: statusCode,
      })

      return NextResponse.json(
        { success: false, error: { code: result.error.code, message: result.error.message } },
        { status: statusCode }
      )
    }

    // ✅ Успех: проверяем, что data существует
    if (!result.data || !result.data.title || !result.data.description) {
      console.error('[generate-card] invalid result shape', { data: result.data })
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Неверный ответ от генератора' } },
        { status: 500 }
      )
    }

    console.info('[generate-card] success', { titleLength: result.data.title.length })

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[generate-card] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Неизвестная ошибка при генерации',
        },
      },
      { status: 500 }
    )
  }
}
