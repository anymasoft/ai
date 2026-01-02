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
      `SELECT id, email, generation_balance, generation_used FROM users ORDER BY email ASC`
    )
    const users = Array.isArray(usersResult) ? usersResult : usersResult.rows || []

    const balances = users.map((user: any) => ({
      userId: user.id,
      email: user.email,
      generation_balance: user.generation_balance || 0,
      generation_used: user.generation_used || 0,
      remaining: Math.max(0, (user.generation_balance || 0) - (user.generation_used || 0)),
    }))

    return NextResponse.json({ balances })
  } catch (error) {
    console.error('[GET /api/admin/limits] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
