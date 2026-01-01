import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/config/styles - получить все активные стили
export async function GET(request: NextRequest) {
  try {
    const result = await db.execute(
      `SELECT key, title, prompt FROM styles WHERE is_active = 1 ORDER BY key`
    )

    const styles = (result.rows as Array<{ key: string; title: string; prompt: string }>).map(
      (style) => ({
        key: style.key,
        title: style.title,
        prompt: style.prompt,
      })
    )

    return NextResponse.json({ styles })
  } catch (error) {
    console.error("❌ Error fetching styles:", error)
    return NextResponse.json({ error: "Failed to fetch styles" }, { status: 500 })
  }
}
