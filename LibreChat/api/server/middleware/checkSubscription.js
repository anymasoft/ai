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

// Кэш планов — обновляется раз в 60 секунд, чтобы не ходить в БД на каждый запрос
let _planCache = null;
let _cacheExpiresAt = 0;
const CACHE_TTL = 60_000;

async function getPlans() {
  if (_planCache && Date.now() < _cacheExpiresAt) return _planCache;
  await Plan.seedDefaults();
  const plans = await Plan.find({}, 'planId allowedModels isActive').lean();
  _planCache = Object.fromEntries(plans.map((p) => [p.planId, p]));
  _cacheExpiresAt = Date.now() + CACHE_TTL;
  return _planCache;
}

/** Вызывать после обновления планов в admin, чтобы сразу применились новые allowedModels. */
function invalidatePlanCache() {
  _planCache = null;
}

function isModelAllowed(planConfig, modelName) {
  if (!planConfig || !modelName) return true;
  const allowed = planConfig.allowedModels || [];
  if (allowed.length === 0) return true;       // пустой = все модели разрешены
  return allowed.includes(modelName);          // exact match по полному modelId
}

async function checkSubscription(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id; // ObjectId для поиска
    if (!userId) return next();

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
    // checkSubscription ДОЛЖЕН быть ПОСЛЕ buildEndpointOption в middleware цепочке
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
      logger.info(`[MODEL CHECK] "${modelId}" against plan "${plan}"`, {
        model: modelId,
        plan,
        userId,
      });

      const plans = await getPlans();
      const planConfig = plans[plan];
      if (!isModelAllowed(planConfig, modelId)) {
        logger.warn(`[MODEL_DENIED] User="${userId}" tried model="${modelId}" on plan="${plan}"`);
        return res.status(403).json({
          error: `Модель "${modelId}" недоступна на плане "${plan}". Перейдите на Pro или Business.`,
          code: 'MODEL_NOT_ALLOWED',
        });
      }
    }

    next();
  } catch (err) {
    next();
  }
}

module.exports = checkSubscription;
module.exports.invalidatePlanCache = invalidatePlanCache;
