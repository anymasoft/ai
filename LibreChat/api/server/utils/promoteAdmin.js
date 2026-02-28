'use strict';
const { logger } = require('@librechat/data-schemas');

/**
 * При старте сервера: если ADMIN_EMAIL задан в .env,
 * находит пользователя по email и устанавливает роль ADMIN.
 * Идемпотентно — повторный вызов не ломает уже существующего ADMIN.
 */
async function promoteAdminByEmail({ findUser, updateUser }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return;
  }

  try {
    const user = await findUser({ email: adminEmail }, 'email role _id');
    if (!user) {
      logger.warn(`[promoteAdmin] Пользователь с email ${adminEmail} не найден. Зарегистрируйтесь сначала.`);
      return;
    }

    if (user.role === 'ADMIN') {
      logger.info(`[promoteAdmin] ${adminEmail} уже ADMIN — пропускаем.`);
      return;
    }

    await updateUser(user._id.toString(), { role: 'ADMIN' });
    logger.info(`[promoteAdmin] ${adminEmail} успешно назначен ADMIN.`);
  } catch (err) {
    logger.error('[promoteAdmin] Ошибка при назначении ADMIN:', err);
  }
}

module.exports = { promoteAdminByEmail };
