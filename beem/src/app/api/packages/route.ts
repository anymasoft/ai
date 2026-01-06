/**
 * Public API для получения доступных пакетов генераций
 * GET /api/packages - получить активные пакеты
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const result = await db.execute(
      `SELECT key, title, price_rub, generations, is_active FROM packages WHERE is_active = 1 ORDER BY price_rub ASC`
    )

    const packages = Array.isArray(result) ? result : result.rows || []

    return NextResponse.json({ success: true, packages })
  } catch (error) {
    console.error('[GET /api/packages] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch packages' },
      { status: 500 }
    )
  }
}
