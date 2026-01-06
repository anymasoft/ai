#!/usr/bin/env tsx

/**
 * Проверка структуры базы данных
 * Убеждаемся что колонка language определена корректно
 */

import { createClient } from "@libsql/client";

async function checkDatabaseStructure() {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";

  console.log("Подключение к БД:", dbPath);

  const client = createClient({
    url: dbPath,
  });

  try {
    // Получаем структуру таблицы users
    console.log("\n=== Структура таблицы users ===");
    const tableInfo = await client.execute("PRAGMA table_info(users)");

    if (tableInfo.rows.length === 0) {
      console.log("⚠️  Таблица users не существует");
      return;
    }

    console.log("\nКолонки таблицы users:");
    tableInfo.rows.forEach((row: any) => {
      console.log(`  ${row.cid}: ${row.name} (${row.type}) ${row.notnull ? "NOT NULL" : ""} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ""}`);
    });

    // Проверяем наличие колонки language
    const languageColumn = tableInfo.rows.find((row: any) => row.name === "language");

    if (languageColumn) {
      console.log("\n✅ Колонка language найдена:");
      console.log(`   Тип: ${languageColumn.type}`);
      console.log(`   NOT NULL: ${languageColumn.notnull ? "да" : "нет"}`);
      console.log(`   Значение по умолчанию: ${languageColumn.dflt_value || "не задано"}`);
    } else {
      console.log("\n❌ Колонка language НЕ найдена!");
    }

    // Проверяем таблицу channel_ai_comment_insights
    console.log("\n=== Проверка таблицы channel_ai_comment_insights ===");
    const insightsTableInfo = await client.execute("PRAGMA table_info(channel_ai_comment_insights)");

    if (insightsTableInfo.rows.length === 0) {
      console.log("⚠️  Таблица channel_ai_comment_insights не существует");
    } else {
      console.log("✅ Таблица channel_ai_comment_insights существует");
      console.log(`   Количество колонок: ${insightsTableInfo.rows.length}`);
    }

    console.log("\n✅ Проверка структуры БД завершена успешно");
  } catch (error) {
    console.error("\n❌ Ошибка при проверке структуры БД:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

checkDatabaseStructure();
