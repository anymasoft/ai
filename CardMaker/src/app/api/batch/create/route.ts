import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { getClient } from '@/lib/db'
import { randomUUID } from 'crypto'

// Схема для одного item в batch
const batchItemSchema = z.object({
  description: z.string().min(1, 'Описание обязательно'),
  category: z.string().min(1, 'Категория обязательна'),
  seoKeywords: z.array(z.string()).optional().default([]),
  competitors: z.array(z.string()).optional().default([]),
})

// Схема для request body
const batchCreateSchema = z.object({
  marketplace: z.enum(['ozon', 'wb']),
  style: z.enum(['selling', 'expert', 'brief']).default('selling'),
  items: z.array(batchItemSchema).min(1, 'Нужен хотя бы один товар'),
})

const MAX_ITEMS_PER_BATCH = 200
const MAX_QUEUED_JOBS_PER_USER = 300

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const body = await request.json()

    // Валидируем входные данные
    const validation = batchCreateSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: `Ошибка валидации: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    const { marketplace, style, items } = validation.data

    // Проверяем лимит на количество товаров в одном batch
    if (items.length > MAX_ITEMS_PER_BATCH) {
      return NextResponse.json(
        { error: `Максимум ${MAX_ITEMS_PER_BATCH} товаров в одном batch` },
        { status: 400 }
      )
    }

    const db = await getClient()

    // Проверяем количество queued jobs для пользователя в БД
    const queuedResult = await db.execute(
      `SELECT COUNT(*) as count FROM jobs WHERE status IN ('queued', 'processing')`
    )
    const queuedCount = ((queuedResult.rows?.[0] as any)?.count || 0) as number
    if (queuedCount + items.length > MAX_QUEUED_JOBS_PER_USER) {
      return NextResponse.json(
        { error: 'Слишком много задач в очереди. Дождитесь завершения текущих.' },
        { status: 429 }
      )
    }

    // Создаём batch запись в БД
    const batchId = randomUUID()
    await db.execute(
      `INSERT INTO batches (id, userId, marketplace, style, totalItems, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
      [batchId, session.user.id, marketplace, style, items.length, Date.now(), Date.now()]
    )

    // Добавляем каждый item как job в очередь
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex]
      const jobId = randomUUID()

      const jobPayload = {
        batchId,
        itemIndex,
        description: item.description,
        category: item.category,
        marketplace,
        style,
        seoKeywords: item.seoKeywords || [],
        competitors: item.competitors || [],
      }

      await db.execute(
        `INSERT INTO jobs (id, type, status, payload, created_at, updated_at)
         VALUES (?, 'batch_card', 'queued', ?, ?, ?)`,
        [jobId, JSON.stringify(jobPayload), Date.now(), Date.now()]
      )
    }

    return NextResponse.json(
      {
        success: true,
        batchId,
        totalItems: items.length,
        pollingUrl: `/api/batch/${batchId}`,
      },
      { status: 202 } // 202 Accepted
    )
  } catch (error) {
    console.error('[POST /api/batch/create] Ошибка:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      },
      { status: 500 }
    )
  }
}
