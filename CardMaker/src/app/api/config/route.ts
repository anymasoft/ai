import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/config - получить всю конфигурацию (для UI и проверки "Config missing")
export async function GET(request: NextRequest) {
  try {
    // Загрузить все конфиги из БД параллельно
    const [promptsResult, stylesResult, rulesResult, stopWordsResult] = await Promise.all([
      db.execute(`SELECT key, content FROM system_prompts WHERE is_active = 1 ORDER BY key`),
      db.execute(`SELECT id, key, title, prompt FROM styles WHERE is_active = 1 ORDER BY key`),
      db.execute(`SELECT marketplace, content FROM marketplace_rules WHERE is_active = 1 ORDER BY marketplace`),
      db.execute(`SELECT id, marketplace, category, words FROM stop_words WHERE is_active = 1 ORDER BY marketplace, category`),
    ])

    // Форматировать промпты
    const prompts = Object.fromEntries(
      (promptsResult.rows as Array<{ key: string; content: string }>).map((row) => [
        row.key,
        row.content,
      ])
    )

    // Форматировать стили
    const styles = (stylesResult.rows as Array<{ key: string; title: string; prompt: string }>).map(
      (style) => ({
        key: style.key,
        title: style.title,
        prompt: style.prompt,
      })
    )

    // Форматировать правила маркетплейсов
    const marketplaceRules = Object.fromEntries(
      (rulesResult.rows as Array<{ marketplace: string; content: string }>).map((row) => [
        row.marketplace,
        row.content,
      ])
    )

    // Форматировать стоп-слова
    const stopWords = (stopWordsResult.rows as Array<{ marketplace?: string; category: string; words: string }>)

    // Проверка: какие конфиги отсутствуют?
    const missing = []
    if (!prompts.gen_base) missing.push("gen_base")
    if (!prompts.validate_base) missing.push("validate_base")
    if (styles.length === 0) missing.push("styles")
    if (!marketplaceRules.ozon && !marketplaceRules.wb) missing.push("marketplace_rules")

    return NextResponse.json({
      prompts: {
        gen_base: prompts.gen_base || "",
        validate_base: prompts.validate_base || "",
      },
      styles,
      marketplaceRules,
      stopWords,
      missing: missing.length > 0 ? missing : null, // null = всё доступно
      ready: missing.length === 0, // true = готово к использованию
    })
  } catch (error) {
    console.error("❌ Error loading config:", error)
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    )
  }
}
