import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

/**
 * Admin API для управления лимитами
 * GET /api/admin/limits - получить все лимиты
 * POST /api/admin/limits - обновить лимит
 */

// Проверка прав администратора
async function checkAdminAccess(session: any): Promise<boolean> {
  if (!session?.user?.id) return false

  try {
    const db = await getClient()
    const result = await db.execute(
      'SELECT role FROM users WHERE id = ? LIMIT 1',
      [session.user.id]
    )
    const rows = Array.isArray(result) ? result : result.rows || []
    const user = rows[0] as any
    return user?.role === 'admin'
  } catch (error) {
    console.error('[Admin Limits] Check access error:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !(await checkAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const db = await getClient()
    const result = await db.execute('SELECT key, value, description FROM limits_config ORDER BY key ASC')
    const rows = Array.isArray(result) ? result : result.rows || []

    return NextResponse.json({
      success: true,
      limits: rows,
    })
  } catch (error) {
    console.error('[GET /api/admin/limits] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !(await checkAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { key, value } = body

    // Валидация
    if (!key || typeof value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request: key and number value are required' },
        { status: 400 }
      )
    }

    const db = await getClient()

    // Обновить или создать лимит
    await db.execute(
      `INSERT INTO limits_config (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, value, Date.now()]
    )

    console.log(`[Admin] Updated limit ${key} to ${value}`)

    return NextResponse.json({
      success: true,
      message: `Limit ${key} updated to ${value}`,
    })
  } catch (error) {
    console.error('[POST /api/admin/limits] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
