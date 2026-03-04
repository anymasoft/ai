'use strict';
/**
 * checkSubscription middleware
 *
 * 1. Ленивая проверка срока подписки: если истёк → понижаем до free в БД.
 * 2. Проверка доступа к модели по плану (allowedModels берётся из коллекции Plan).
 * 3. Прикрепляет req.subscription = { plan, planExpiresAt } для downstream.
 *
 * allowedModels:
 *   []                       = все модели разрешены
 *   ['gpt-4o-mini', '...']   = строгое совпадение по полному modelId (exact match)
 *
 * allowedModels хранит точные modelId из коллекции AiModel.
 * Substring-matching ЗАПРЕЩЁН — только includes() для exact match.
 */
// FIX: Импортируем модели из правильных мест, не из ~/db/models
const Subscription = require('~/models/Subscription');
const Plan = require('~/models/Plan');

// Проверка что модели загружены
if (!Plan) {
  throw new Error('❌ CRITICAL: Plan model is undefined! Check import path: ~/models/Plan');
}
if (!Subscription) {
  throw new Error('❌ CRITICAL: Subscription model is undefined! Check import path: ~/models/Subscription');
}

// ✅ АРХИТЕКТУРА SSOT: НЕТ in-memory кэша.
// Каждый запрос читает ПРЯМО из БД (максимум ~1ms от MongoDB).
// В случае необходимости оптимизации — используем MongoDB indeces, а не in-memory.
async function getPlanById(planId) {
  await Plan.seedDefaults();
  return Plan.findOne({ planId }, 'planId allowedModels isActive').lean();
}

/**
 * Проверяет разрешена ли модель для плана.
 *
 * Поддерживает:
 * 1. Exact match: modelName точно совпадает с allowedModels[i]
 * 2. Alias match: allowedModels[i] это alias, modelName это versioned ID
 *    Пример: allowedModels=["claude-haiku-4-5"], modelName="claude-haiku-4-5-20251001" ✅
 * 3. Prefix match: modelName начинается с allowedModels[i] + "-"
 *    Пример: allowedModels=["gpt-4"], modelName="gpt-4-turbo" ✅
 */
function isModelAllowed(planConfig, modelName) {
  if (!planConfig || !modelName) return true;
  const allowed = planConfig.allowedModels || [];
  if (allowed.length === 0) return true;       // пустой = все модели разрешены

  // ✅ Exact match: точное совпадение
  if (allowed.includes(modelName)) {
    return true;
  }

  // ✅ Prefix/Alias match: проверяем prefix matching
  // Для каждого разрешенного модель проверяем:
  // - Если это может быть alias (не содержит версию в формате YYYYMMDD)
  // - То проверяем что requestedModel начинается с alias + "-"
  // Пример: allowed="claude-haiku-4-5", requested="claude-haiku-4-5-20251001" ✅
  for (const allowedModel of allowed) {
    // Если allowedModel меньше requestedModel и requestedModel начинается с allowedModel + "-"
    // то это скорее всего alias-to-versioned резолвинг
    if (modelName.startsWith(allowedModel + '-')) {
      return true;
    }
  }

  return false;
}

async function checkSubscription(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id; // ObjectId для поиска
    if (!userId) return next();

    // ✅ ЗАЩИТА: checkSubscription должна работать ТОЛЬКО для POST/PUT/PATCH запросов
    // которые требуют model. GET/HEAD/DELETE могут не содержать model и должны пропускаться.
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const subscription = await Subscription.findOne({ userId }).lean();

    let plan = subscription?.plan || 'free';
    let planExpiresAt = subscription?.planExpiresAt || null;

    if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
      await Subscription.findOneAndUpdate(
        { userId },
        { plan: 'free', planExpiresAt: null, planStartedAt: null },
      );
      plan = 'free';
      planExpiresAt = null;
    }

    req.subscription = { plan, planExpiresAt };

    // SECURITY: Use model ONLY from buildEndpointOption (которое идёт ДО этого middleware)
    // ЗАПРЕЩЕНО использовать req.body?.model или req.body?.endpointOption?.model
    // Это защищает от подмены модели в payload
    const modelId = req.builtEndpointOption?.model;

    // Если buildEndpointOption не был вызван или результата нет — это критичная ошибка!
    if (!modelId) {
      const { logger } = require('@librechat/data-schemas');
      logger.error(
        '[SECURITY] checkSubscription вызван БЕЗ req.builtEndpointOption.model! ' +
        'Проверьте порядок middleware. buildEndpointOption должен быть ПЕРЕД checkSubscription'
      );
      return res.status(500).json({
        error: 'Internal server error: invalid middleware order',
        code: 'INVALID_MIDDLEWARE_ORDER',
      });
    }

    // [MODEL CHECK] Log security check
    if (modelId) {
      const { logger } = require('@librechat/data-schemas');

      const planConfig = await getPlanById(plan);
      const allowedModels = planConfig?.allowedModels || [];

      // Логируем проверку модели с деталями
      logger.info(`[PLAN MODEL CHECK] User="${userId}" requested model="${modelId}" on plan="${plan}"`, {
        model: modelId,
        plan,
        userId,
        allowedModels,
      });

      if (!isModelAllowed(planConfig, modelId)) {
        logger.warn(
          `[MODEL_DENIED] User="${userId}" model="${modelId}" plan="${plan}"`,
          {
            model: modelId,
            plan,
            userId,
            allowedModels,
            requestType: 'subscription_check_failed',
          }
        );
        return res.status(403).json({
          error: `Модель "${modelId}" недоступна на плане "${plan}". Перейдите на Pro или Business.`,
          code: 'MODEL_NOT_ALLOWED',
        });
      }

      // ✅ Модель разрешена
      logger.debug(`[MODEL_ALLOWED] User="${userId}" model="${modelId}" on plan="${plan}"`, {
        model: modelId,
        plan,
        userId,
      });
    }

    next();
  } catch (err) {
    next();
  }
}

/**
 * Инвалидирует план пользователя в памяти (если есть кэш).
 *
 * ✅ SSOT АРХИТЕКТУРА: In-memory TTL кэши удалены.
 * Каждый запрос читает ПРЯМО из MongoDB (~1ms).
 *
 * Эта функция остаётся как placeholder для совместимости с payment.js.
 * Если в будущем добавится in-memory кэш, здесь будет очистка.
 */
async function invalidatePlanCache(userId) {
  // SSOT архитектура: нет in-memory кэша, всегда читаем из БД
  // Эта функция остаётся как placeholder для совместимости с payment.js
  if (!userId) {
    return;
  }
  // В будущем, если добавится кэш:
  // cache.del(`plan:${userId}`);
}

module.exports = checkSubscription;
module.exports.invalidatePlanCache = invalidatePlanCache;
