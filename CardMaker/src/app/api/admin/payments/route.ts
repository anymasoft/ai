import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

// Начало дня (00:00:00)
function parseLocalDateStart(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  return Math.floor(date.getTime() / 1000)
}

// Конец дня (23:59:59)
function parseLocalDateEnd(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day, 23, 59, 59, 999)
  return Math.floor(date.getTime() / 1000)
}

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const { searchParams } = new URL(request.url)
    const emailFilter = searchParams.get("email") || ""
    const fromDateStr = searchParams.get("from")
    const toDateStr = searchParams.get("to")

    let fromDate: number | null = null
    let toDate: number | null = null

    if (fromDateStr) {
      fromDate = parseLocalDateStart(fromDateStr)
    }

    if (toDateStr) {
      toDate = parseLocalDateEnd(toDateStr)
    }

    // Get all payments from payments table with package info
    let query = `
      SELECT
        p.id,
        p.userId,
        u.email,
        p.packageKey,
        pk.title as packageTitle,
        pk.generations,
        p.amount,
        p.status,
        p.provider,
        p.createdAt
      FROM payments p
      JOIN users u ON p.userId = u.id
      LEFT JOIN packages pk ON p.packageKey = pk.key
      WHERE 1=1
    `

    const params: any[] = []

    if (emailFilter) {
      query += ` AND u.email LIKE ?`
      params.push(`%${emailFilter}%`)
    }

    if (fromDate !== null) {
      query += ` AND p.createdAt >= ?`
      params.push(fromDate)
    }

    if (toDate !== null) {
      query += ` AND p.createdAt <= ?`
      params.push(toDate)
    }

    query += ` ORDER BY p.createdAt DESC LIMIT 500`

    // Всегда передаём массив параметров (может быть пустым)
    const result = await db.execute(query, params.length > 0 ? params : [])

    // libsql возвращает { rows: [...] }
    const rows = Array.isArray(result) ? result : (result.rows || [])

    const payments = rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      email: row.email,
      packageKey: row.packageKey,
      packageTitle: row.packageTitle || row.packageKey,
      generations: row.generations || 0,
      amount: row.amount,
      status: row.status,
      provider: row.provider,
      createdAt: row.createdAt,
    }))

    // Calculate total sum in rubles
    const totalSum = payments.reduce((sum, payment) => {
      return sum + (payment.amount || 0)
    }, 0)

    return NextResponse.json({
      payments,
      total: payments.length,
      totalSum,
    })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}
