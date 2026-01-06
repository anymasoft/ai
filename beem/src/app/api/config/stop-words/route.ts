import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/config/stop-words?marketplace=ozon|wb - получить стоп-слова
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketplace = searchParams.get("marketplace")

    let query = `SELECT id, marketplace, category, words FROM stop_words WHERE is_active = 1`
    const params: any[] = []

    if (marketplace) {
      // Получить стоп-слова для конкретного маркетплейса или общие
      query += ` AND (marketplace = ? OR marketplace IS NULL) ORDER BY category`
      params.push(marketplace)
    } else {
      // Получить все стоп-слова
      query += ` ORDER BY marketplace, category`
    }

    const result = await db.execute(query, params.length > 0 ? params : undefined)

    const stopWords = (result.rows as Array<{
      id: string
      marketplace?: string
      category: string
      words: string
    }>).map((sw) => ({
      id: sw.id,
      marketplace: sw.marketplace || null,
      category: sw.category,
      words: sw.words,
    }))

    return NextResponse.json({ stopWords })
  } catch (error) {
    console.error("❌ Error fetching stop words:", error)
    return NextResponse.json({ error: "Failed to fetch stop words" }, { status: 500 })
  }
}
