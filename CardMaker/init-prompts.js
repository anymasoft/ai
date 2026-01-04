#!/usr/bin/env node

/**
 * ПРОСТОЙ СКРИПТ ДЛЯ ВОССТАНОВЛЕНИЯ ПРОМПТОВ
 *
 * Этот скрипт ПРЕДПОЛАГАЕТ что таблицы уже созданы миграцией 008
 * Он ТОЛЬКО обновляет содержимое промптов и правил
 */

const { createClient } = require('@libsql/client')

const DATABASE_URL = process.env.DATABASE_URL || 'file:./beem.db'

async function initPrompts() {
  const client = createClient({
    url: DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })

  console.log('🚀 ИНИЦИАЛИЗАЦИЯ ПРОМПТОВ И ПРАВИЛ')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    console.log('\n1️⃣  Обновление GEN_BASE промпта...')
    const genPrompt = `Ты опытный копирайтер маркетплейса с 10+ летним стажем.

ТВОЯ ЗАДАЧА: Создавать привлекательные описания товаров для маркетплейсов.

ПРИНЦИПЫ:
1. Фокус на выгоду для покупателя
2. Конкретность с цифрами и характеристиками
3. Честность без преувеличений
4. Структурированность`

    await client.execute({
      sql: `UPDATE system_prompts SET content = ?, updated_at = CAST(strftime('%s','now') AS integer) WHERE key = ?`,
      args: [genPrompt, 'gen_base'],
    })
    console.log('✅ GEN_BASE обновлён')

    console.log('\n2️⃣  Обновление VALIDATE_BASE промпта...')
    const validatePrompt = `Ты инспектор качества описаний товаров на маркетплейсах.

ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА:
1. Проверить наличие ЗАПРЕЩЁННЫХ СЛОВ
2. Проверить СООТВЕТСТВИЕ ПРАВИЛАМ МАРКЕТПЛЕЙСА

НЕ ПРОВЕРЯЙ: грамматику, читаемость, преувеличения

ВЫВОДЫ ТОЛЬКО JSON:
{
  "isValid": boolean,
  "violations": [
    {
      "type": "marketplace_rule" | "forbidden_word",
      "severity": "error" | "warning",
      "description": "суть нарушения",
      "text_fragment": "цитата"
    }
  ]
}`

    await client.execute({
      sql: `UPDATE system_prompts SET content = ?, updated_at = CAST(strftime('%s','now') AS integer) WHERE key = ?`,
      args: [validatePrompt, 'validate_base'],
    })
    console.log('✅ VALIDATE_BASE обновлён')

    console.log('\n3️⃣  Обновление ОЗОН правил...')
    const ozonRules = `ПРАВИЛА ОЗОНА:

1. ЗАПРЕТЫ:
   - Контакты продавца (телефон, ватсап)
   - Просьбы связаться в ЛС
   - Информация о доставке

2. ТРЕБОВАНИЯ:
   - Минимум 10 слов
   - Максимум 3000 символов
   - Начинай с большой буквы`

    await client.execute({
      sql: `UPDATE marketplace_rules SET content = ?, updated_at = CAST(strftime('%s','now') AS integer) WHERE marketplace = ?`,
      args: [ozonRules, 'ozon'],
    })
    console.log('✅ Озон правила обновлены')

    console.log('\n4️⃣  Обновление WILDBERRIES правил...')
    const wbRules = `ПРАВИЛА WILDBERRIES:

1. ЗАПРЕТЫ:
   - Контактные данные
   - Просьбы связаться
   - Информация о доставке

2. ТРЕБОВАНИЯ:
   - Минимум 5 слов
   - Максимум 1500 символов
   - Первое предложение - важное`

    await client.execute({
      sql: `UPDATE marketplace_rules SET content = ?, updated_at = CAST(strftime('%s','now') AS integer) WHERE marketplace = ?`,
      args: [wbRules, 'wb'],
    })
    console.log('✅ WildBerries правила обновлены')

    console.log('\n5️⃣  Инициализация стоп-слов...')
    const stopWordsText = `гарантия вечная
звоните в ватсап
обращайтесь в личные сообщения
лучший товар
уникальный товар`

    await client.execute({
      sql: `UPDATE stop_words SET words = ?, updated_at = CAST(strftime('%s','now') AS integer) WHERE category = ? AND marketplace IS NULL`,
      args: [stopWordsText, 'marketing'],
    })
    console.log('✅ Стоп-слова обновлены')

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ ПРОМПТЫ И ПРАВИЛА ВОССТАНОВЛЕНЫ!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('\n❌ ОШИБКА:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

initPrompts().then(() => process.exit(0))
