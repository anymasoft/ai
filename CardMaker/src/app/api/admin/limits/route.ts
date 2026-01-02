import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAccess } from '@/lib/admin-api'
import { db } from '@/lib/db'

/**
 * Admin API для просмотра пакетов генераций
 * GET /api/admin/limits - получить пакеты всех пользователей
 */

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const usersResult = await db.execute(
      `SELECT id, email, total_generations, used_generations FROM users ORDER BY email ASC`
    )
    const users = Array.isArray(usersResult) ? usersResult : usersResult.rows || []

    const usages = users.map((user: any) => ({
      userId: user.id,
      email: user.email,
      total_generations: user.total_generations || 0,
      used_generations: user.used_generations || 0,
      remaining_generations: Math.max(0, (user.total_generations || 0) - (user.used_generations || 0)),
    }))

    return NextResponse.json({ usages })
  } catch (error) {
    console.error('[GET /api/admin/limits] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
