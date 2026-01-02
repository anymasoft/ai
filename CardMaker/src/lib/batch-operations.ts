'use server'

import { db } from './db'
import { randomUUID } from 'crypto'

/**
 * Создать новый batch в БД
 */
export async function createBatchRecord(params: {
  userId: string
  marketplace: 'ozon' | 'wb'
  style: 'selling' | 'expert' | 'brief'
  totalItems: number
}): Promise<string> {
  const batchId = randomUUID()
  const now = Math.floor(Date.now() / 1000)

  await db.execute(
    `INSERT INTO batches (id, userId, marketplace, style, totalItems, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
    [batchId, params.userId, params.marketplace, params.style, params.totalItems, now, now]
  )

  return batchId
}

/**
 * Получить batch из БД
 */
export async function getBatchRecord(batchId: string): Promise<any | null> {
  try {
    const result = await db.execute(
      `SELECT id, userId, marketplace, style, totalItems, status, createdAt, updatedAt
       FROM batches WHERE id = ? LIMIT 1`,
      [batchId]
    )

    const rows = Array.isArray(result) ? result : result.rows || []
    return rows[0] || null
  } catch (error) {
    console.error('[getBatchRecord] Error:', error)
    return null
  }
}

/**
 * Обновить статус batch в БД
 */
export async function updateBatchStatus(batchId: string, status: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  await db.execute(
    `UPDATE batches SET status = ?, updatedAt = ? WHERE id = ?`,
    [status, now, batchId]
  )
}

/**
 * Получить статистику jobs для batch'а
 */
export async function getBatchJobsStats(batchId: string): Promise<{
  total: number
  queued: number
  processing: number
  completed: number
  failed: number
}> {
  try {
    // Получаем jobs которые содержат batchId в payload
    const result = await db.execute(
      `SELECT
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        COUNT(*) as total
       FROM jobs
       WHERE payload LIKE ?`,
      [`%"batchId":"${batchId}"%`]
    )

    const rows = Array.isArray(result) ? result : result.rows || []
    const row = rows[0]

    return {
      total: row?.total || 0,
      queued: row?.queued || 0,
      processing: row?.processing || 0,
      completed: row?.completed || 0,
      failed: row?.failed || 0,
    }
  } catch (error) {
    console.error('[getBatchJobsStats] Error:', error)
    return { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 }
  }
}

/**
 * Получить все jobs для batch'а
 */
export async function getBatchJobs(batchId: string): Promise<any[]> {
  try {
    const result = await db.execute(
      `SELECT id, status, result, error FROM jobs
       WHERE payload LIKE ?
       ORDER BY created_at ASC`,
      [`%"batchId":"${batchId}"%`]
    )

    const rows = Array.isArray(result) ? result : result.rows || []
    return rows
  } catch (error) {
    console.error('[getBatchJobs] Error:', error)
    return []
  }
}
