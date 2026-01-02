import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

/**
 * Admin API для просмотра лимитов и использования
 * GET /api/admin/limits - получить использование всех пользователей
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

    // Получить всех пользователей с их планами
    const usersResult = await db.execute(
      `SELECT id, email, name, plan FROM users ORDER BY email ASC`
    )
    const users = Array.isArray(usersResult) ? usersResult : usersResult.rows || []

    // Для каждого пользователя получить использование и лимиты
    const today = new Date().toISOString().split('T')[0]

    const usages = []
    for (const user of users) {
      const userId = user.id as string
      const plan = user.plan as string

      // Получить дневное использование
      const usageResult = await db.execute(
        `SELECT COALESCE(SUM(cardsUsed), 0) as totalUsed FROM user_usage_daily
         WHERE userId = ? AND day = ?`,
        [userId, today]
      )
      const usageRows = Array.isArray(usageResult) ? usageResult : usageResult.rows || []
      const monthlyUsed = usageRows[0]?.totalUsed || 0

      // Получить per-user лимит (если существует таблица)
      let monthlyLimit = 0
      const limitKey = `single_daily_limit_${plan}`

      // Сначала проверить per-user override
      let userLimitResult: any = null
      try {
        const userLimitQueryResult = await db.execute(
          `SELECT value FROM user_limits WHERE userId = ? AND key = ? LIMIT 1`,
          [userId, limitKey]
        )
        userLimitResult = Array.isArray(userLimitQueryResult) ? userLimitQueryResult[0] : (userLimitQueryResult.rows?.[0] || null)
      } catch (e) {
        // таблица user_limits может не существовать
      }

      if (userLimitResult?.value) {
        monthlyLimit = userLimitResult.value
      } else {
        // Получить глобальный лимит по плану
        const globalLimitResult = await db.execute(
          `SELECT value FROM limits_config WHERE key = ? LIMIT 1`,
          [limitKey]
        )
        const limitRows = Array.isArray(globalLimitResult) ? globalLimitResult : globalLimitResult.rows || []
        monthlyLimit = limitRows[0]?.value || 0
      }

      const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed)
      const percentageUsed = monthlyLimit > 0 ? Math.round((monthlyUsed / monthlyLimit) * 100) : 0

      usages.push({
        userId,
        email: user.email,
        name: user.name,
        plan,
        monthlyLimit,
        monthlyUsed,
        monthlyRemaining,
        percentageUsed,
      })
    }

    return NextResponse.json({
      usages,
    })
  } catch (error) {
    console.error('[GET /api/admin/limits] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
