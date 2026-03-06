'use strict';
/**
 * ensureBalance middleware
 * 
 * Гарантирует, что у каждого аутентифицированного пользователя есть Balance запись.
 * Вызывается после authenticateUser/requireJwtAuth.
 * 
 * Использует оригинальный createSetBalanceConfig из @librechat/api.
 * Идемпотентен: если Balance уже существует, просто обновляет settings если нужно.
 */

const { createSetBalanceConfig } = require('@librechat/api');
const { Balance } = require('~/db/models');
const { getAppConfig } = require('~/server/services/Config');

// Создаем middleware один раз при запуске
let ensureBalanceMiddleware = null;

async function initializeEnsureBalance() {
  if (!ensureBalanceMiddleware) {
    ensureBalanceMiddleware = createSetBalanceConfig({
      getAppConfig,
      Balance,
    });
  }
  return ensureBalanceMiddleware;
}

/**
 * Middleware, который применяет balance инициализацию для authenticated users
 * ТОЛЬКО если req.user существует (т.е. пользователь аутентифицирован)
 */
async function ensureBalance(req, res, next) {
  // Пропустить, если пользователь не аутентифицирован
  if (!req.user) {
    return next();
  }

  // Применить createSetBalanceConfig для аутентифицированного пользователя
  try {
    const middleware = await initializeEnsureBalance();
    return middleware(req, res, next);
  } catch (err) {
    const { logger } = require('@librechat/data-schemas');
    logger.error('[ensureBalance] Error initializing balance:', err);
    // Ошибка в balance не должна блокировать запрос
    next();
  }
}

module.exports = ensureBalance;
