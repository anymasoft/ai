import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { globalJobQueue } from '@/lib/job-queue'
import { getBatchRecord, getBatchJobsStats, getBatchJobs, updateBatchStatus } from '@/lib/batch-operations'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: batchId } = params

    if (!batchId) {
      return NextResponse.json({ error: 'Требуется batch ID' }, { status: 400 })
    }

    // Получаем информацию о batch из БД
    const batchRecord = await getBatchRecord(batchId)

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
    const stats = await getBatchJobsStats(batchId)

    // Получаем детали всех jobs (если их не слишком много)
    const batchJobs = await getBatchJobs(batchId)

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
      await updateBatchStatus(batchId, currentStatus)
    }

    // Формируем ответ
    return NextResponse.json({
      id: batchId,
      status: currentStatus,
      marketplace: batchRecord.marketplace,
      style: batchRecord.style,
      totalItems: batchRecord.totalItems,
      stats: {
        queued: stats.queued,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
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
