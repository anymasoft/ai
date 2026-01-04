'use server'

import { db } from '@/lib/db'

/**
 * Типы для конфигурации промптов
 */
export interface SystemPromptConfig {
  id: string
  key: string
  content: string
  isActive: boolean
}

export interface StyleConfig {
  id: string
  key: string
  title: string
  prompt: string
  isActive: boolean
}

export interface MarketplaceRulesConfig {
  id: string
  marketplace: string
  content: string
  isActive: boolean
}

export interface StopWordsConfig {
  category: string
  words: string[]
}

/**
 * Загрузить system prompts из БД
 */
export const loadSystemPrompts = async (): Promise<SystemPromptConfig[]> => {
  try {
    const result = await db.execute(
      'SELECT id, key, content, is_active as isActive FROM system_prompts WHERE is_active = 1 ORDER BY key'
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    return rows.map((row: any) => ({
      id: row.id,
      key: row.key,
      content: row.content || '',
      isActive: row.isActive === 1,
    }))
  } catch (error) {
    console.error('[loadSystemPrompts] Ошибка загрузки:', error)
    return []
  }
}

/**
 * Загрузить стили из БД
 */
export const loadStyles = async (): Promise<StyleConfig[]> => {
  try {
    const result = await db.execute(
      'SELECT id, key, title, prompt, is_active as isActive FROM styles WHERE is_active = 1 ORDER BY key'
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    return rows.map((row: any) => ({
      id: row.id,
      key: row.key,
      title: row.title || '',
      prompt: row.prompt || '',
      isActive: row.isActive === 1,
    }))
  } catch (error) {
    console.error('[loadStyles] Ошибка загрузки:', error)
    return []
  }
}

/**
 * Загрузить правила маркетплейса из БД
 */
export const loadMarketplaceRules = async (
  marketplace: string
): Promise<string> => {
  try {
    const result = await db.execute(
      'SELECT content FROM marketplace_rules WHERE marketplace = ? AND is_active = 1 LIMIT 1',
      [marketplace]
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    return rows[0]?.content || ''
  } catch (error) {
    console.error(`[loadMarketplaceRules] Ошибка загрузки для ${marketplace}:`, error)
    return ''
  }
}

/**
 * Загрузить стоп-слова из БД
 */
export const loadStopWords = async (
  marketplace?: string
): Promise<StopWordsConfig[]> => {
  try {
    let query =
      'SELECT category, words FROM stop_words WHERE is_active = 1 AND marketplace IS NULL'
    const params: any[] = []

    if (marketplace) {
      query =
        'SELECT category, words FROM stop_words WHERE is_active = 1 AND (marketplace IS NULL OR marketplace = ?) ORDER BY marketplace DESC, category'
      params.push(marketplace)
    }

    const result = await db.execute(query, params)

    const rows = Array.isArray(result) ? result : result.rows || []

    return rows.map((row: any) => ({
      category: row.category,
      words: row.words
        ? row.words.split('\n').filter((w: string) => w.trim().length > 0)
        : [],
    }))
  } catch (error) {
    console.error('[loadStopWords] Ошибка загрузки:', error)
    return []
  }
}

/**
 * Загрузить мини-промпт категории из БД
 */
export const loadCategoryPrompt = async (
  categoryKey: string
): Promise<string> => {
  try {
    const result = await db.execute(
      'SELECT prompt FROM category_prompts WHERE key = ? AND is_active = 1 LIMIT 1',
      [categoryKey]
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    return rows[0]?.prompt?.trim() || ''
  } catch (error) {
    console.error(`[loadCategoryPrompt] Ошибка загрузки для ${categoryKey}:`, error)
    return ''
  }
}

/**
 * Построить промпт для генерации описания
 *
 * Структура промпта:
 * 1. Base system prompt из БД
 * 2. Выбранный стиль
 * 3. Правила маркетплейса
 * 4. Стоп-слова для валидации
 * 5. (ОПЦИОНАЛЬНО) SEO-ключи, если есть
 * 6. (ОПЦИОНАЛЬНО) Описания конкурентов, если есть
 * 7. Инструкции о формате ответа
 */
export const buildGenerationPrompt = async (params: {
  productTitle: string
  productCategory: string
  marketplace: 'ozon' | 'wb'
  style: string
  seoKeywords?: string[]
  competitors?: string[]
  additionalNotes?: string
}): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const {
    productTitle,
    productCategory,
    marketplace,
    style,
    seoKeywords = [],
    competitors = [],
    additionalNotes = '',
  } = params

  // Загружаем все необходимые данные параллельно
  const [systemPrompts, styles, marketplaceRules, stopWords, categoryPrompt] = await Promise.all([
    loadSystemPrompts(),
    loadStyles(),
    loadMarketplaceRules(marketplace),
    loadStopWords(marketplace),
    loadCategoryPrompt(productCategory),
  ])

  // Находим base prompt для генерации
  const basePrompt =
    systemPrompts.find((p) => p.key === 'gen_base')?.content ||
    'Ты опытный копирайтер маркетплейса с 10+ летним стажем. Твоя задача - создавать привлекательные описания товаров.'

  // Находим выбранный стиль
  const selectedStyle = styles.find((s) => s.key === style)
  const stylePrompt = selectedStyle
    ? `\nСтиль описания: ${selectedStyle.title}\n${selectedStyle.prompt}`
    : ''

  // [ДИАГНОСТИКА] Логируем выбранный стиль в dev режиме
  if (process.env.NODE_ENV !== 'production') {
    console.log('[buildGenerationPrompt] Style Info:', {
      requestedKey: style,
      foundStyle: selectedStyle?.key || '❌ NOT FOUND',
      styleTitle: selectedStyle?.title || '-',
      stylePromptLength: selectedStyle?.prompt?.length || 0,
      allAvailableStyles: styles.map((s) => ({ key: s.key, title: s.title })),
    })
  }

  // Компонуем стоп-слова в удобный список
  const stopWordsList = stopWords
    .map((sw) => {
      if (sw.words.length === 0) return null
      return `${sw.category}: ${sw.words.slice(0, 10).join(', ')}${sw.words.length > 10 ? '...' : ''}`
    })
    .filter(Boolean)
    .join('\n')

  // Строим системный промпт
  const categoryBlock = categoryPrompt
    ? `\n\n═══════════════════════════════════════════════════════════════
ИНСТРУКЦИИ ПО КАТЕГОРИИ:
═══════════════════════════════════════════════════════════════
${categoryPrompt}`
    : ''

  const systemPrompt = `${basePrompt}
${stylePrompt}

═══════════════════════════════════════════════════════════════
ПРАВИЛА И ТРЕБОВАНИЯ:
═══════════════════════════════════════════════════════════════

## Маркетплейс: ${marketplace === 'ozon' ? 'Озон' : 'WildBerries'}
${marketplaceRules ? `\n${marketplaceRules}` : ''}${categoryBlock}

## Важные ограничения (ЗАПРЕЩЕНО ИСПОЛЬЗОВАТЬ):
${stopWordsList || 'Основные запреты: преувеличение, медицинские обещания, гарантии без оснований'}

## Требования к описанию:
- Максимум 300 символов для заголовка
- Максимум 1500 символов для основного описания
- Четкие, конкретные преимущества товара
- Обращение к целевой аудитории
- Без пустых слов и воды
- Правильная пунктуация и орфография`

  // Проверяем наличие валидных SEO-ключей (ОПЦИОНАЛЬНО)
  const hasSeoKeywords =
    Array.isArray(seoKeywords) &&
    seoKeywords.some((k) => k && k.trim().length > 0)

  // [ДИАГНОСТИКА] Логируем SEO-ключи в dev режиме
  if (process.env.NODE_ENV !== 'production') {
    const validSeoKeys = seoKeywords.filter((k) => k && k.trim().length > 0)
    console.log('[buildGenerationPrompt] SEO Keywords:', {
      hasSeoKeywords,
      count: validSeoKeys.length,
      keywords: validSeoKeys.slice(0, 3), // показываем первые 3
      willBeAddedToPrompt: hasSeoKeywords,
    })
  }

  // Проверяем наличие валидных описаний конкурентов (ОПЦИОНАЛЬНО)
  const validCompetitors = competitors.filter((c) => c && c.trim().length > 0)
  const hasCompetitors = validCompetitors.length > 0

  // Строим пользовательский промпт
  const userPromptParts = [
    `Создай описание для товара:

ТОВАР:
- Название: ${productTitle}
- Категория: ${productCategory}`,
  ]

  // Добавляем SEO-ключи ТОЛЬКО если есть хотя бы одно значение
  if (hasSeoKeywords) {
    userPromptParts.push(`\nSEO-ключи для оптимизации поиска:
${seoKeywords.filter((k) => k && k.trim().length > 0).join(', ')}`)
  }

  // Добавляем описания конкурентов ТОЛЬКО если есть хотя бы одно описание
  if (hasCompetitors) {
    userPromptParts.push(`\nДля вдохновения (описания товаров конкурентов):
${validCompetitors.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`)
  }

  // Добавляем дополнительные заметки если есть
  if (additionalNotes && additionalNotes.trim()) {
    userPromptParts.push(`\nДополнительная информация:
${additionalNotes}`)
  }

  userPromptParts.push(`
Ответь ТОЛЬКО описанием товара, без дополнительных комментариев или объяснений.
Структура ответа:
1. Заголовок (до 300 символов)
2. Основное описание (до 1500 символов)`)

  const userPrompt = userPromptParts.join('')

  // [ДИАГНОСТИКА] Логируем полностью assembled prompt в dev режиме
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `\n${'═'.repeat(80)}\n[buildGenerationPrompt] FULL PROMPT FOR STYLE: ${selectedStyle?.key || 'UNKNOWN'}\n${'═'.repeat(80)}\n`
    )
    console.log('SYSTEM PROMPT (первые 500 символов):')
    console.log(systemPrompt.substring(0, 500))
    console.log('\n... (остальное сокращено для читаемости)\n')

    console.log('USER PROMPT (полностью):')
    console.log(userPrompt)

    console.log(
      `\n${'═'.repeat(80)}\nSTYLE ANALYSIS:\n${'═'.repeat(80)}`
    )
    console.log({
      styleKey: selectedStyle?.key,
      styleTitle: selectedStyle?.title,
      stylePromptEmpty: !selectedStyle?.prompt || selectedStyle.prompt.trim().length === 0,
      hasSeoKeywords,
      seoBlockPresent: userPrompt.includes('SEO-ключи'),
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    })
    console.log(`${'═'.repeat(80)}\n`)
  }

  return {
    systemPrompt,
    userPrompt,
  }
}

/**
 * ШАГ 2: ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ ПРОМПТ ВАЛИДАЦИИ
 *
 * Построить промпт для валидации описания товара
 *
 * НОВЫЙ ПОДХОД:
 * - ТОЛЬКО 2 типа нарушений: marketplace_rule и forbidden_word
 * - НИКАКИХ grammar/clarity/exaggeration
 * - Детерминированный формат ответа
 * - Temperature = 0
 *
 * Структура промпта:
 * 1. Base validation prompt из БД (validate_base)
 * 2. Правила маркетплейса (marketplace-specific)
 * 3. Список запрещённых слов (из стоп-слов)
 * 4. ФИКСИРОВАННАЯ инструкция на JSON (без вариаций)
 */
export const buildValidationPrompt = async (params: {
  description: string
  marketplace: 'ozon' | 'wb'
}): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const { description, marketplace } = params

  // Загружаем необходимые данные
  const [systemPrompts, marketplaceRules, stopWords] = await Promise.all([
    loadSystemPrompts(),
    loadMarketplaceRules(marketplace),
    loadStopWords(marketplace),
  ])

  // Находим base prompt для валидации
  const basePrompt =
    systemPrompts.find((p) => p.key === 'validate_base')?.content ||
    `Ты инспектор качества описаний товаров на маркетплейсах.
Твоя ЕДИНСТВЕННАЯ задача:
1. Проверить наличие ЗАПРЕЩЁННЫХ СЛОВ
2. Проверить СООТВЕТСТВИЕ ПРАВИЛАМ МАРКЕТПЛЕЙСА

БЕЗ ИСКЛЮЧЕНИЙ:
- НЕ проверяй грамматику
- НЕ оценивай читаемость
- НЕ ищи преувеличения
- НЕ давай рекомендации
- ТОЛЬКО выявляй нарушения правил и запрещённые слова`

  // Компонуем стоп-слова в простой список
  const forbiddenWordsList = stopWords
    .flatMap((sw) => sw.words.slice(0, 20)) // Берём первые 20 слов из каждой категории
    .filter((word, idx, arr) => arr.indexOf(word) === idx) // Уникальные
    .join(', ')

  // Строим системный промпт (ФИКСИРОВАННЫЙ ФОРМАТ)
  const systemPrompt = `${basePrompt}

═══════════════════════════════════════════════════════════════
ПРАВИЛА МАРКЕТПЛЕЙСА: ${marketplace === 'ozon' ? 'Озон' : 'Wildberries'}
═══════════════════════════════════════════════════════════════

${marketplaceRules}

═══════════════════════════════════════════════════════════════
ЗАПРЕЩЁННЫЕ СЛОВА И ФРАЗЫ
═══════════════════════════════════════════════════════════════

${forbiddenWordsList || 'Список стоп-слов не загружен'}

═══════════════════════════════════════════════════════════════
ТРЕБОВАНИЕ К ОТВЕТУ (ОБЯЗАТЕЛЬНО)
═══════════════════════════════════════════════════════════════

ОТВЕТЬ СТРОГО JSON (никакого другого текста):

{
  "isValid": boolean,
  "violations": [
    {
      "type": "marketplace_rule" | "forbidden_word",
      "severity": "error" | "warning",
      "description": "КОРОТКО опиши, что нарушено",
      "text_fragment": "цитата из текста, где нарушение"
    }
  ]
}

ТРЕБОВАНИЯ К VIOLATIONS:
- ТОЛЬКО если нашел нарушения
- type ТОЛЬКО эти два: marketplace_rule ИЛИ forbidden_word
- severity: error если критично, warning если менее важно
- description: одна строка, суть нарушения
- text_fragment: точная цитата из описания

НЕ ДОЛЖНО БЫТЬ:
- suggestions (только констатация)
- пояснения (только факты)
- категории, отличные от указанных двух`

  // Строим пользовательский промпт (МИНИМАЛЬНЫЙ, ЧЁТКИЙ)
  const userPrompt = `Проверь это описание товара на нарушения правил маркетплейса и запрещённые слова:

───────────────────────────────────────────
ОПИСАНИЕ ТОВАРА:
───────────────────────────────────────────
${description}
───────────────────────────────────────────

ОТВЕТЬ ТОЛЬКО JSON, не пиши ничего больше.`

  return {
    systemPrompt,
    userPrompt,
  }
}
