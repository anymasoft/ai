#!/usr/bin/env node

/**
 * Миграционный скрипт для очистки Yandex OAuth email уязвимости
 *
 * Проблема:
 * - Некоторые пользователи были созданы с фиктивным email: yandex_ID@librechat.local
 * - Это произошло когда Yandex API не вернул email в профиле
 *
 * Решение:
 * - Деактивировать все аккаунты с @librechat.local email
 * - Оставить данные в БД (GDPR compliance)
 * - Пользователи могут пересоздать аккаунт с правильным email
 *
 * Использование:
 * node scripts/migrate-fix-yandex-emails.js [--delete] [--dry-run]
 *
 * Флаги:
 * --delete    Удалить аккаунты вместо деактивации (ОПАСНО!)
 * --dry-run   Показать что будет изменено без сохранения
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
const isDryRun = process.argv.includes('--dry-run');
const isDelete = process.argv.includes('--delete');

console.log(`
${'═'.repeat(70)}
  🔧 МИГРАЦИЯ: Очистка Yandex OAuth email уязвимости
${'═'.repeat(70)}

Параметры:
  - Dry run: ${isDryRun ? '✅ ДА (не будут сохранены изменения)' : '❌ НЕТ (изменения будут сохранены)'}
  - Метод: ${isDelete ? '❌ DELETE (удалить аккаунты)' : '✅ DEACTIVATE (деактивировать)'}
  - Mongo URI: ${mongoUri}

${'═'.repeat(70)}
`);

/**
 * Подключиться к MongoDB и выполнить миграцию
 */
async function runMigration() {
  try {
    // Подключиться к MongoDB
    console.log('📡 Подключение к MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Подключено к MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // ШАГ 1: Найти все проблемные аккаунты
    console.log('🔍 ШАГ 1: Поиск аккаунтов с @librechat.local email...\n');

    const invalidUsers = await usersCollection
      .find({ email: /@librechat\.local$/ })
      .toArray();

    if (invalidUsers.length === 0) {
      console.log('✅ Не найдено аккаунтов с @librechat.local email');
      console.log('📌 Миграция не требуется\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`⚠️  НАЙДЕНО: ${invalidUsers.length} аккаунтов с @librechat.local email\n`);
    console.log('Детали:\n');
    invalidUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Username: ${user.username || 'N/A'}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Created: ${user.createdAt?.toISOString() || 'N/A'}`);
      console.log(`   ID: ${user._id}\n`);
    });

    // ШАГ 2: Подтверждение действия
    console.log(`${'─'.repeat(70)}\n`);

    if (!isDryRun) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise((resolve) => {
        const action = isDelete ? 'УДАЛИТЬ' : 'ДЕАКТИВИРОВАТЬ';
        const warning = isDelete
          ? '⚠️  ВНИМАНИЕ: Это удалит ВСЕ данные пользователей!'
          : '📌 Аккаунты будут деактивированы, данные сохранены для GDPR';

        console.log(`\n${warning}`);
        console.log(`Действие: ${action} ${invalidUsers.length} аккаунтов\n`);

        rl.question(`Вы уверены? Введите "ДА" для подтверждения: `, async (answer) => {
          rl.close();

          if (answer !== 'ДА') {
            console.log('\n❌ Отменено пользователем\n');
            await mongoose.connection.close();
            process.exit(1);
          }

          await performMigration(usersCollection, invalidUsers);
          resolve();
        });
      });
    } else {
      console.log('🔍 DRY RUN: Показываем что будет изменено\n');
      await performMigration(usersCollection, invalidUsers);
    }
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }
}

/**
 * Выполнить миграцию
 */
async function performMigration(usersCollection, invalidUsers) {
  try {
    // ШАГ 3: Выполнить действие
    console.log(`\n📝 ШАГ 2: Выполнение действия...\n`);

    if (isDelete) {
      // ОПАСНО: Удалить аккаунты
      if (isDryRun) {
        console.log(`[DRY RUN] Будут УДАЛЕНЫ ${invalidUsers.length} аккаунтов:`);
        invalidUsers.forEach((user) => {
          console.log(`  - ${user.email}`);
        });
      } else {
        const result = await usersCollection.deleteMany({
          email: /@librechat\.local$/,
        });

        console.log(`✅ УДАЛЕНО ${result.deletedCount} аккаунтов\n`);

        invalidUsers.forEach((user) => {
          console.log(`  ✓ УДАЛЕН: ${user.email}`);
        });
      }
    } else {
      // БЕЗОПАСНО: Деактивировать аккаунты
      const updateData = {
        $set: {
          deactivated: true,
          deactivatedReason: 'invalid_librechat_local_email_cleanup',
          deactivatedAt: new Date(),
          deactivatedNote:
            'Account created with invalid placeholder email. ' +
            'Yandex profile did not include email address. ' +
            'Please create a new account with proper Yandex credentials.',
        },
      };

      if (isDryRun) {
        console.log(`[DRY RUN] Будут ДЕАКТИВИРОВАНЫ ${invalidUsers.length} аккаунтов:`);
        invalidUsers.forEach((user) => {
          console.log(`  - ${user.email}`);
        });
        console.log(`\nДанные будут обновлены:`);
        console.log(JSON.stringify(updateData, null, 2));
      } else {
        const result = await usersCollection.updateMany(
          { email: /@librechat\.local$/ },
          updateData,
        );

        console.log(
          `✅ ДЕАКТИВИРОВАНО ${result.modifiedCount} аккаунтов\n` +
            `   (данные сохранены для GDPR compliance)\n`
        );

        invalidUsers.forEach((user) => {
          console.log(`  ✓ ДЕАКТИВИРОВАН: ${user.email}`);
        });
      }
    }

    // ШАГ 4: Проверка результатов
    console.log(`\n📊 ШАГ 3: Проверка результатов...\n`);

    const remainingInvalidUsers = await usersCollection
      .find({ email: /@librechat\.local$/ })
      .toArray();

    const remainingDeactivated = await usersCollection
      .find({ deactivated: true, email: /@librechat\.local$/ })
      .toArray();

    if (isDryRun) {
      console.log('[DRY RUN] Результаты не сохранены');
    } else {
      if (isDelete) {
        console.log(`✅ Осталось аккаунтов с @librechat.local: ${remainingInvalidUsers.length}`);
      } else {
        console.log(
          `✅ Деактивировано аккаунтов: ${remainingDeactivated.length}` +
            `\n   Осталось активных @librechat.local: ${
              remainingInvalidUsers.length - remainingDeactivated.length
            }`
        );
      }
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ✅ МИГРАЦИЯ ${isDryRun ? '[DRY RUN] ' : ''}ЗАВЕРШЕНА`);
    console.log(`${'═'.repeat(70)}\n`);

    if (!isDryRun) {
      console.log('📌 Следующие шаги:');
      if (isDelete) {
        console.log('1. ✅ Удалены аккаунты');
        console.log('2. 📧 Отправить уведомление пользователям о пересоздании аккаунта');
        console.log('3. 🔔 Настроить алерты чтобы это больше не произошло');
      } else {
        console.log('1. ✅ Деактивированы аккаунты (данные сохранены)');
        console.log('2. 📧 Отправить уведомление пользователям с объяснением');
        console.log('3. 🔧 Проверить что Yandex OAuth исправлен');
        console.log('4. 🔔 Настроить алерты чтобы это больше не произошло');
      }
      console.log('5. 📊 Мониторить новые регистрации через Yandex\n');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Запуск
runMigration().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
