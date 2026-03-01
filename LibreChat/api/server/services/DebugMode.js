'use strict';
/**
 * Debug Mode Service
 *
 * Отвечает за добавление debug информации о реальной модели и расходе токенов
 * в ответ API, если debugModelUsage включен в SystemSettings.
 */
const { SystemSettings, Balance } = require('~/db/models');

/**
 * Получить текущее значение debugModelUsage
 * @returns {Promise<boolean>}
 */
async function isDebugModeEnabled() {
  try {
    if (!SystemSettings || typeof SystemSettings.getValue !== 'function') {
      return false;
    }
    const value = await SystemSettings.getValue('debugModelUsage', false);
    return Boolean(value);
  } catch (err) {
    // Если ошибка при чтении - вернуть false (безопасный fallback)
    return false;
  }
}

/**
 * Добавить debug информацию в ответ сообщения
 *
 * @param {Object} params - Параметры
 * @param {Object} params.response - Объект ответа модели (response message)
 * @param {string} params.requestedModel - Запрошенная модель (из запроса)
 * @param {string} params.userId - ID пользователя
 * @returns {Promise<void>} Модифицирует response объект in-place
 */
async function enrichWithDebugInfo(params) {
  const { response, requestedModel, userId } = params;

  if (!response) {
    return;
  }

  try {
    // Проверяем включен ли debug mode
    const debugEnabled = await isDebugModeEnabled();
    if (!debugEnabled) {
      return;
    }

    // Извлекаем информацию о модели из response
    const actualModel = response.model || requestedModel;

    // Извлекаем информацию о токенах
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    // Проверяем несколько возможных путей для usage информации
    if (response.usage) {
      promptTokens = response.usage.prompt_tokens || response.usage.input_tokens || 0;
      completionTokens = response.usage.completion_tokens || response.usage.output_tokens || 0;
      totalTokens = response.usage.total_tokens || (promptTokens + completionTokens);
    }

    // Получаем текущий баланс пользователя
    let remainingTokenCredits = 0;
    try {
      const balance = await Balance.findOne({ user: userId }).lean();
      remainingTokenCredits = balance?.tokenCredits || 0;
    } catch (err) {
      // Если ошибка при чтении баланса - просто не добавляем это значение
    }

    // Рассчитываем приблизительный расход tokenCredits
    // Формула: totalTokens * 1 (1 tokenCredit per token as default)
    // Это приблизительное значение, точное считается в spendTokens
    const tokenCreditsCharged = totalTokens || 0;

    // Добавляем debug блок в response
    response.debug = {
      requestedModel,
      actualModel: actualModel || requestedModel,
      promptTokens,
      completionTokens,
      totalTokens,
      tokenCreditsCharged,
      remainingTokenCredits,
    };
  } catch (err) {
    // Если ошибка при обогащении debug информацией - просто не добавляем (не ломаем основной функционал)
    // Логируем ошибку для диагностики
    const { logger } = require('@librechat/data-schemas');
    logger.warn('[DebugMode] Error enriching debug info:', err);
  }
}

/**
 * Удалить debug информацию из ответа (если она есть)
 * Используется для сокращения размера ответа в production
 *
 * @param {Object} response - Объект ответа
 */
function removeDebugInfo(response) {
  if (response && response.debug) {
    delete response.debug;
  }
}

module.exports = {
  isDebugModeEnabled,
  enrichWithDebugInfo,
  removeDebugInfo,
};
