import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { globalJobQueue } from '@/lib/job-queue'
import { randomUUID } from 'crypto'

// Схема валидации для request body
// ВАЖНО: соответствует реальному body из UI (card-generator/page.tsx)
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

    // Создаём job для обработки через очередь
    const jobId = randomUUID()

    // Параметры для генерации
    const jobPayload = {
      type: 'single_generation',
      payload: {
        description: validation.data.productDescription,
        category: validation.data.category,
        marketplace: validation.data.marketplace,
        style: validation.data.style,
        seoKeywords: validation.data.seoKeywords,
        competitors: validation.data.competitors,
      },
    }

    // Добавляем job в очередь
    globalJobQueue.enqueue(jobId, session.user.id, jobPayload)

    // Возвращаем jobId для polling
    return NextResponse.json(
      {
        success: true,
        jobId,
        pollingUrl: `/api/jobs/${jobId}`,
      },
      { status: 202 } // 202 Accepted - задача принята в очередь
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
