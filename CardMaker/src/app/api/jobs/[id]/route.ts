import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { globalJobQueue } from '@/lib/job-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Требуется job ID' }, { status: 400 })
    }

    // Получить задачу из очереди
    const job = globalJobQueue.getJob(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Проверить, что job принадлежит текущему пользователю
    if (job.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Вернуть статус job'а
    return NextResponse.json({
      id: job.id,
      status: job.status,
      result: job.result || null,
      error: job.error || null,
      createdAt: job.createdAt,
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null,
    })
  } catch (error) {
    console.error('[GET /api/jobs/[id]] Ошибка:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      },
      { status: 500 }
    )
  }
}
