import { getNodeDb } from './db'
import { generateProductCard } from './ai-services/generation'

/**
 * Worker для обработки batch jobs из БД
 * Простой loop без параллелизма - 1 поток, обработка по одному
 */

let isRunning = false

interface JobRecord {
  id: string
  payload: string
  status: string
}

/**
 * Запустить worker - обрабатывает jobs из очереди
 * Должен работать как долгоживущий процесс
 */
export async function startBatchWorker() {
  if (isRunning) {
    console.log('[BatchWorker] Already running')
    return
  }

  isRunning = true
  console.log('[BatchWorker] Starting (infinite loop, 1 thread)')

  while (true) {
    try {
      await processOneJob()
      // Небольшая задержка перед следующей проверкой
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('[BatchWorker] Unexpected error:', error)
      // При ошибке ждём и продолжаем
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

/**
 * Обработать одну задачу из очереди
 */
async function processOneJob(): Promise<void> {
  const db = await getNodeDb()

  // 1. Найти первый queued job
  const jobsResult = await db.execute(
    `SELECT id, payload FROM jobs
     WHERE status = 'queued'
     ORDER BY created_at ASC
     LIMIT 1`
  )

  const job = jobsResult.rows?.[0] as JobRecord | undefined
  if (!job) {
    // Нет задач - ничего не делаем
    return
  }

  const jobId = job.id

  try {
    // 2. Попытаться захватить job (обновить на processing)
    // Используем UPDATE с WHERE чтобы гарантировать, что никто другой его не взял
    const updateResult = await db.execute(
      `UPDATE jobs
       SET status = 'processing', updated_at = ?
       WHERE id = ? AND status = 'queued'`,
      [Date.now(), jobId]
    )

    // Если никто не обновил (значит другой процесс взял) - выходим
    if (!updateResult.rows || (updateResult.rows as any)[0]?.changes === 0) {
      return
    }

    // 3. Распарсить payload
    let payload: any
    try {
      payload = JSON.parse(job.payload)
    } catch (e) {
      throw new Error(`Invalid JSON in payload: ${e}`)
    }

    const {
      batchId,
      description,
      category,
      marketplace,
      style,
      seoKeywords = [],
      competitors = [],
    } = payload

    if (!description || !category || !marketplace || !style) {
      throw new Error('Missing required fields in payload')
    }

    // 4. Вызвать generateProductCard
    // userId не критичен для batch, но нужен для функции
    const result = await generateProductCard({
      productTitle: description,
      productCategory: category,
      marketplace: marketplace as 'ozon' | 'wb',
      style: style as 'selling' | 'expert' | 'brief',
      seoKeywords,
      competitors,
      userId: 'batch-worker', // системное значение
    })

    // 5. Сохранить результат
    if (!result.success) {
      throw new Error(result.error?.message || 'Generation failed')
    }

    await db.execute(
      `UPDATE jobs
       SET status = 'done', result = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(result.data), Date.now(), jobId]
    )

    console.log(`[BatchWorker] Job ${jobId} completed`)
  } catch (error) {
    // 6. Обработать ошибку
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[BatchWorker] Job ${jobId} failed:`, errorMessage)

    await db.execute(
      `UPDATE jobs
       SET status = 'failed', error = ?, updated_at = ?
       WHERE id = ?`,
      [errorMessage, Date.now(), jobId]
    )
  }
}

/**
 * Остановить worker
 */
export function stopBatchWorker() {
  isRunning = false
  console.log('[BatchWorker] Stopping')
}

/**
 * Проверить, работает ли worker
 */
export function isBatchWorkerRunning(): boolean {
  return isRunning
}
