import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: batchId } = await params

    if (!batchId) {
      return NextResponse.json({ error: 'Требуется batch ID' }, { status: 400 })
    }

    const db = await getClient()

    // Получаем информацию о batch из БД
    const batchResult = await db.execute(
      `SELECT * FROM batches WHERE id = ?`,
      [batchId]
    )
    const batchRecord = batchResult.rows?.[0] as any

    if (!batchRecord) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Проверяем, что batch принадлежит текущему пользователю
    if (batchRecord.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Получаем статистику jobs для этого batch
    const statsResult = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM jobs
      WHERE JSON_EXTRACT(payload, '$.batchId') = ?`,
      [batchId]
    )
    const stats = (statsResult.rows?.[0] as any) || { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 }

    // Получаем детали всех jobs
    const jobsResult = await db.execute(
      `SELECT id, status, result, error FROM jobs
       WHERE JSON_EXTRACT(payload, '$.batchId') = ?
       ORDER BY created_at ASC`,
      [batchId]
    )
    const batchJobs = jobsResult.rows || []

    // Вычисляем текущий статус batch
    let currentStatus = batchRecord.status
    if (stats.total > 0) {
      if (stats.completed === stats.total) {
        currentStatus = 'completed'
      } else if (stats.processing > 0 || stats.queued > 0) {
        currentStatus = 'processing'
      }
    }

    // Обновляем статус в БД если изменился
    if (currentStatus !== batchRecord.status) {
      await db.execute(
        `UPDATE batches SET status = ?, updatedAt = ? WHERE id = ?`,
        [currentStatus, Date.now(), batchId]
      )
    }

    // Формируем ответ
    return NextResponse.json({
      id: batchId,
      status: currentStatus,
      marketplace: batchRecord.marketplace,
      style: batchRecord.style,
      totalItems: batchRecord.totalItems,
      stats: {
        queued: stats.queued || 0,
        processing: stats.processing || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
      },
      items: batchJobs.map((job: any) => {
        let result = null
        if (job.result) {
          try {
            result = typeof job.result === 'string' ? JSON.parse(job.result) : job.result
          } catch (e) {
            result = job.result
          }
        }
        return {
          jobId: job.id,
          status: job.status,
          result,
          error: job.error || null,
        }
      }),
      createdAt: batchRecord.createdAt,
      updatedAt: batchRecord.updatedAt,
    })
  } catch (error) {
    console.error('[GET /api/batch/[id]] Ошибка:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      },
      { status: 500 }
    )
  }
}
