import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { generateProductCard } from '@/lib/ai-services/generation'
import { deductCredits } from '@/lib/billing/deductCredits'

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

    // Синхронно вызываем генерацию (БЕЗ userId — списание будет отдельно)
    const result = await generateProductCard({
      productTitle: validation.data.productDescription,
      productCategory: validation.data.category,
      marketplace: validation.data.marketplace,
      style: validation.data.style,
      seoKeywords: validation.data.seoKeywords,
      competitors: validation.data.competitors,
    })

    // ✅ КРИТИЧЕСКАЯ ПРОВЕРКА: result.success
    if (!result.success) {
      const statusCode =
        result.error.code === 'LIMIT_EXCEEDED' ? 429 :
        result.error.code === 'INVALID_INPUT' ? 400 :
        500

      return NextResponse.json(
        { success: false, error: { code: result.error.code, message: result.error.message } },
        { status: statusCode }
      )
    }

    // ✅ Успех: проверяем, что data существует
    if (!result.data || !result.data.title || !result.data.description) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Неверный ответ от генератора' } },
        { status: 500 }
      )
    }

    // Операция выполнена успешно → списать 1 кредит
    const deductResult = await deductCredits(session.user.id, 1, 'generate')
    if (!deductResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_BALANCE', message: 'Не удалось списать кредит (недостаточно средств)' } },
        { status: 402 }
      )
    }

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
