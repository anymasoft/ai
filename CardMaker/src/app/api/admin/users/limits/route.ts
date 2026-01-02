import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAccess } from '@/lib/admin-api'
import { db } from '@/lib/db'

/**
 * API для управления per-user лимитами
 * POST - установить/добавить/сбросить лимит пользователя
 */

export async function POST(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()
    const { userId, key, value, action } = body

    if (!userId || !key || !action) {
      return NextResponse.json(
        { error: 'userId, key, and action are required' },
        { status: 400 }
      )
    }

    // action: 'set' | 'add' | 'reset'
    if (!['set', 'add', 'reset'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be set, add, or reset' },
        { status: 400 }
      )
    }

    // Валидация value для set и add
    if ((action === 'set' || action === 'add') && (typeof value !== 'number' || value < 0)) {
      return NextResponse.json(
        { error: 'value must be a non-negative number for set/add actions' },
        { status: 400 }
      )
    }

    // Получить пользователя для проверки существования
    const userResult = await db.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
    const userRows = Array.isArray(userResult) ? userResult : userResult.rows || []
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (action === 'reset') {
      // Удалить per-user лимит (вернуться к глобальному)
      await db.execute('DELETE FROM user_limits WHERE userId = ? AND key = ?', [userId, key])
      return NextResponse.json({ success: true, message: 'User limit reset' })
    } else if (action === 'set') {
      // Установить новый лимит
      await db.execute(
        `INSERT INTO user_limits (userId, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(userId, key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        [userId, key, value, Math.floor(Date.now() / 1000)]
      )
      return NextResponse.json({ success: true, message: `User limit set to ${value}` })
    } else if (action === 'add') {
      // Добавить к существующему лимиту (или к глобальному, если нет per-user)
      // Сначала получить текущий лимит
      let currentValue = 0
      const currentResult = await db.execute(
        'SELECT value FROM user_limits WHERE userId = ? AND key = ? LIMIT 1',
        [userId, key]
      )
      const currentRows = Array.isArray(currentResult) ? currentResult : currentResult.rows || []

      if (currentRows.length > 0) {
        currentValue = currentRows[0].value
      } else {
        // Если нет per-user, получить глобальный лимит
        const globalResult = await db.execute(
          'SELECT value FROM limits_config WHERE key = ? LIMIT 1',
          [key]
        )
        const globalRows = Array.isArray(globalResult) ? globalResult : globalResult.rows || []
        if (globalRows.length > 0) {
          currentValue = globalRows[0].value
        }
      }

      const newValue = currentValue + value
      await db.execute(
        `INSERT INTO user_limits (userId, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(userId, key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        [userId, key, newValue, Math.floor(Date.now() / 1000)]
      )
      return NextResponse.json({ success: true, message: `User limit increased from ${currentValue} to ${newValue}` })
    }
  } catch (error) {
    console.error('Error managing user limits:', error)
    return NextResponse.json(
      { error: 'Failed to manage user limits' },
      { status: 500 }
    )
  }
}
