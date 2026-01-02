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

// Значения по умолчанию (могут быть переопределены в limits_config БД)
const DEFAULT_MAX_ITEMS_PER_BATCH = 200
const DEFAULT_MAX_QUEUED_JOBS_PER_USER = 300

/**
 * Получить лимит из БД с fallback на значения по умолчанию
 */
async function getLimit(db: any, key: string, fallback: number): Promise<number> {
  try {
    const result = await db.execute(
      `SELECT value FROM limits_config WHERE key = ? LIMIT 1`,
      [key]
    )
    const rows = Array.isArray(result) ? result : result.rows || []
    if (rows.length > 0) {
      return (rows[0] as any).value || fallback
    }
    return fallback
  } catch (error) {
    console.warn(`[batch/create] Failed to get limit ${key}, using fallback`)
    return fallback
  }
}

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

    const db = await getClient()

    // Получаем лимиты из БД
    const maxItemsPerBatch = await getLimit(db, 'batch_max_items_per_request', DEFAULT_MAX_ITEMS_PER_BATCH)
    const maxQueuedPerUser = await getLimit(db, 'batch_max_queued_per_user', DEFAULT_MAX_QUEUED_JOBS_PER_USER)

    // Проверяем лимит на количество товаров в одном batch
    if (items.length > maxItemsPerBatch) {
      return NextResponse.json(
        { error: `Максимум ${maxItemsPerBatch} товаров в одном batch` },
        { status: 400 }
      )
    }

    // Проверяем количество queued jobs ТОЛЬКО для текущего пользователя (PER-USER лимит)
    const queuedResult = await db.execute(
      `SELECT COUNT(*) as count FROM jobs WHERE status IN ('queued', 'processing') AND userId = ?`,
      [session.user.id]
    )
    const queuedCount = ((queuedResult.rows?.[0] as any)?.count || 0) as number
    if (queuedCount + items.length > maxQueuedPerUser) {
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
        userId: session.user.id, // Передаём реальный userId в payload
        description: item.description,
        category: item.category,
        marketplace,
        style,
        seoKeywords: item.seoKeywords || [],
        competitors: item.competitors || [],
      }

      await db.execute(
        `INSERT INTO jobs (id, userId, type, status, payload, created_at, updated_at)
         VALUES (?, ?, 'batch_card', 'queued', ?, ?, ?)`,
        [jobId, session.user.id, JSON.stringify(jobPayload), Date.now(), Date.now()]
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
