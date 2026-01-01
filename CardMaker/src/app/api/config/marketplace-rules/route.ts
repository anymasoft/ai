import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/config/marketplace-rules?marketplace=ozon|wb - получить правила маркетплейса
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketplace = searchParams.get("marketplace")

    if (marketplace) {
      // Получить правило для конкретного маркетплейса
      const result = await db.execute(
        `SELECT marketplace, content FROM marketplace_rules WHERE marketplace = ? AND is_active = 1`,
        [marketplace]
      )

      const rule = result.rows?.[0] as { marketplace: string; content: string } | undefined

      return NextResponse.json({
        marketplace,
        content: rule?.content || "",
      })
    } else {
      // Получить все правила
      const result = await db.execute(
        `SELECT marketplace, content FROM marketplace_rules WHERE is_active = 1 ORDER BY marketplace`
      )

      const rules = Object.fromEntries(
        (result.rows as Array<{ marketplace: string; content: string }>).map((row) => [
          row.marketplace,
          row.content,
        ])
      )

      return NextResponse.json({ rules })
    }
  } catch (error) {
    console.error("❌ Error fetching marketplace rules:", error)
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 })
  }
}
