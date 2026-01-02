/**
 * Standalone batch worker process
 * Запускается отдельно: npm run worker:batch или tsx scripts/batch-worker.ts
 *
 * ⚠️ НИКОГДА не импортируй этот файл в Next.js коде
 */

import { getNodeDb } from '../src/lib/db-node'
import { generateProductCard } from '../src/lib/ai-services/generation'

let isRunning = false

interface JobRecord {
  id: string
  payload: string
  status: string
}

// Simple in-memory кэш для конфигов (TTL 5 минут)
const configCache: Map<string, { value: any; timestamp: number }> = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут

/**
 * Запустить worker - обрабатывает jobs из очереди
 * Должен работать как долгоживущий процесс
 */
async function startBatchWorker() {
  if (isRunning) {
    console.log('[BatchWorker] Already running')
    return
  }

  isRunning = true
  console.log('[BatchWorker] Starting (infinite loop, concurrency-safe)')

  // Запусти recovery один раз при старте
  await recoverStuckJobs()

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

    // 4. Вызвать generateProductCard с РЕАЛЬНЫМ userId из payload
    // userId критичен для лимитов и логирования использования
    const realUserId = payload.userId // реальный пользователь, создавший batch
    const result = await generateProductCard({
      productTitle: description,
      productCategory: category,
      marketplace: marketplace as 'ozon' | 'wb',
      style: style as 'selling' | 'expert' | 'brief',
      seoKeywords,
      competitors,
      userId: realUserId, // реальный userId для лимитов и логирования
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
 * Восстановить зависшие jobs (timeout > job_processing_timeout_seconds)
 * Вернуть их обратно в 'queued' чтобы они могли быть переобработаны
 */
async function recoverStuckJobs(): Promise<void> {
  try {
    const db = await getNodeDb()
    const timeoutSeconds = await getLimit('job_processing_timeout_seconds', 1800)
    const nowSeconds = Math.floor(Date.now() / 1000)
    const cutoffSeconds = nowSeconds - timeoutSeconds

    const result = await db.execute(
      `UPDATE jobs
       SET status = 'queued', updated_at = ?
       WHERE status = 'processing' AND (updated_at IS NULL OR updated_at < ?)`,
      [Date.now(), cutoffSeconds]
    )

    const recoveredCount = (result.rows?.[0] as any)?.changes || 0
    if (recoveredCount > 0) {
      console.log(`[BatchWorker] Recovered ${recoveredCount} stuck jobs`)
    }
  } catch (error) {
    console.error('[BatchWorker] Recovery error:', error)
    // Ошибка recovery не должна прерывать worker
  }
}

/**
 * Получить кэшированный конфиг из БД (с TTL)
 */
async function getCachedConfig(key: string, fallback: any = null): Promise<any> {
  const now = Date.now()
  const cached = configCache.get(key)

  // Проверяем кэш
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value
  }

  try {
    const db = await getNodeDb()
    const result = await db.execute(
      `SELECT value FROM limits_config WHERE key = ? LIMIT 1`,
      [key]
    )
    const rows = result.rows || []
    const value = rows.length > 0 ? (rows[0] as any).value : fallback

    // Кэшируем результат
    configCache.set(key, { value, timestamp: now })
    return value
  } catch (error) {
    console.warn(`[BatchWorker] Failed to get config ${key}, using fallback:`, error)
    return fallback
  }
}

/**
 * Получить лимит из БД с fallback на hardcoded значения (используя кэш)
 */
async function getLimit(key: string, fallback: number): Promise<number> {
  return getCachedConfig(key, fallback)
}

/**
 * Остановить worker
 */
function stopBatchWorker() {
  isRunning = false
  console.log('[BatchWorker] Stopping')
}

/**
 * MAIN: Start the worker
 */
console.log('[BatchWorker] Process starting...')
startBatchWorker().catch((err) => {
  console.error('[BatchWorker] Fatal error:', err)
  process.exit(1)
})

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('[BatchWorker] SIGTERM received, stopping...')
  stopBatchWorker()
  setTimeout(() => process.exit(0), 5000)
})

process.on('SIGINT', () => {
  console.log('[BatchWorker] SIGINT received, stopping...')
  stopBatchWorker()
  setTimeout(() => process.exit(0), 5000)
})
