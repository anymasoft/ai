import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(`
      SELECT key, value FROM system_flags ORDER BY key
    `)

    const flags: Record<string, boolean> = {
      enableTrending: true,
      enableComparison: true,
      enableReports: false,
      enableCooldown: false,
      maintenanceMode: false,
    }

    // Parse values from DB
    (result.rows || []).forEach((row: any) => {
      const value = row.value === "true" ? true : row.value === "false" ? false : row.value
      flags[row.key] = value
    })

    return NextResponse.json({ flags })
  } catch (error) {
    console.error("Error fetching system flags:", error)
    return NextResponse.json(
      { error: "Failed to fetch system flags" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()
    const { flags } = body

    if (!flags || typeof flags !== "object") {
      return NextResponse.json(
        { error: "flags object is required" },
        { status: 400 }
      )
    }

    const updatedAt = Math.floor(Date.now() / 1000)

    // Update each flag
    for (const [key, value] of Object.entries(flags)) {
      const stringValue = String(value)
      await db.execute(`
        INSERT OR REPLACE INTO system_flags (key, value, updatedAt)
        VALUES (?, ?, ?)
      `, [key, stringValue, updatedAt])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating system flags:", error)
    return NextResponse.json(
      { error: "Failed to update system flags" },
      { status: 500 }
    )
  }
}
