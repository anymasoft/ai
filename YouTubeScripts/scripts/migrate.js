#!/usr/bin/env node

/**
 * Скрипт миграции для добавления новых таблиц и колонок
 * Использует @libsql/client
 */

const { createClient } = require("@libsql/client");
const path = require("path");

async function runMigration() {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";

  console.log("Подключение к БД:", dbPath);

  const client = createClient({
    url: dbPath,
  });

  try {
    console.log("Начало миграции...\n");

    // 1. Проверяем наличие колонки language в users
    console.log("1. Проверка колонки language в таблице users...");
    try {
      await client.execute("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'");
      console.log("   ✓ Колонка language добавлена");
    } catch (error) {
      if (error.message.includes("duplicate column")) {
        console.log("   ✓ Колонка language уже существует");
      } else {
        throw error;
      }
    }

    // 2. Создаем таблицу channel_ai_comment_insights
    console.log("\n2. Создание таблицы channel_ai_comment_insights...");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS channel_ai_comment_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channelId TEXT NOT NULL,
        resultJson TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);
    console.log("   ✓ Таблица создана");

    // 3. Создаем индексы
    console.log("\n3. Создание индексов...");
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_channelId
      ON channel_ai_comment_insights(channelId)
    `);
    console.log("   ✓ Индекс idx_channel_ai_insights_channelId создан");

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_createdAt
      ON channel_ai_comment_insights(createdAt DESC)
    `);
    console.log("   ✓ Индекс idx_channel_ai_insights_createdAt создан");

    // 4. Проверяем результат
    console.log("\n4. Проверка созданных объектов...");
    const tables = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='channel_ai_comment_insights'
    `);

    if (tables.rows.length > 0) {
      console.log("   ✓ Таблица channel_ai_comment_insights успешно создана");
    }

    const indexes = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='channel_ai_comment_insights'
    `);

    console.log(`   ✓ Создано индексов: ${indexes.rows.length}`);

    console.log("\n✅ Миграция успешно завершена!");
  } catch (error) {
    console.error("\n❌ Ошибка миграции:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();
