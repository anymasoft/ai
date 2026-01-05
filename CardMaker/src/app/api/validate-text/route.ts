import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { validateDescriptionWithRules } from '@/lib/ai-services/validation'
import { db } from '@/lib/db'
import { z } from 'zod'

// Схема валидации для request body
const validateTextSchema = z.object({
  text: z.string().trim().min(1, 'Текст обязателен').max(5000),
  marketplace: z.enum(['ozon', 'wb']),
})

type ValidateTextRequest = z.infer<typeof validateTextSchema>

/**
 * ШАГ 4: PROTECTED ENDPOINT ДЛЯ /VALIDATE СТРАНИЦЫ
 *
 * - Использует ОДНУ ФУНКЦИЮ валидации (validateDescriptionWithRules)
 * - mode = 'full': возвращает ВСЕ детали (issues, score, summary)
 * - С авторизацией (Auth required)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  try {
    const body = await request.json()
    console.log('[validate-text] raw body:', body)

    // Валидируем входные данные
    const validation = validateTextSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Вызываем ЕДИНУЮ функцию валидации
    const result = await validateDescriptionWithRules({
      description: validation.data.text,
      marketplace: validation.data.marketplace,
      mode: 'full', // ← ПОЛНЫЕ ДАННЫЕ для /validate страницы
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

    // Списать 1 кредит за проверку если пользователь авторизован
    if (session.user.id) {
      await db.execute(
        'UPDATE users SET generation_balance = generation_balance - 1, generation_used = generation_used + 1, updatedAt = ? WHERE id = ?',
        [Math.floor(Date.now() / 1000), session.user.id]
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
