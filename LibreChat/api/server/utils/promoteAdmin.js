'use strict';
const { logger } = require('@librechat/data-schemas');

/**
 * При старте сервера: если ADMIN_EMAIL задан в .env,
 * находит пользователя по email и устанавливает роль admin.
 * Идемпотентно — повторный вызов не ломает уже существующего admin.
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

    if (user.role === 'admin') {
      logger.info(`[promoteAdmin] ${adminEmail} уже admin — пропускаем.`);
      return;
    }

    await updateUser(user._id.toString(), { role: 'admin' });
    logger.info(`[promoteAdmin] ${adminEmail} успешно назначен admin.`);
  } catch (err) {
    logger.error('[promoteAdmin] Ошибка при назначении admin:', err);
  }
}

/**
 * Назначить пользователю админ роль, если его email совпадает с ADMIN_EMAIL.
 * Используется при логине пользователя.
 * Идемпотентно — повторный вызов не ломает уже существующего admin.
 */
async function assignAdminIfEmailMatches(user, { updateUser }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !user) {
    return;
  }

  try {
    // Проверяем совпадение email
    if (user.email !== adminEmail) {
      return;
    }

    // Проверяем, не админ ли уже
    if (user.role === 'admin') {
      logger.debug(`[assignAdminIfEmailMatches] ${adminEmail} уже admin — пропускаем.`);
      return;
    }

    // Назначаем админ роль
    await updateUser(user._id.toString(), { role: 'admin' });
    logger.info(`[assignAdminIfEmailMatches] ${adminEmail} успешно назначен admin при логине.`);
  } catch (err) {
    logger.error('[assignAdminIfEmailMatches] Ошибка при назначении admin:', err);
  }
}

module.exports = { promoteAdminByEmail, assignAdminIfEmailMatches };
