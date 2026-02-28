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
const { Subscription, Plan } = require('~/db/models');

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
    const userId = req.user?._id?.toString() || req.user?.id;
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

    const modelName =
      req.body?.model ||
      req.body?.endpointOption?.model ||
      req.body?.endpointOption?.modelOptions?.model ||
      null;

    if (modelName) {
      const plans = await getPlans();
      const planConfig = plans[plan];
      if (!isModelAllowed(planConfig, modelName)) {
        return res.status(403).json({
          error: `Модель "${modelName}" недоступна на плане "${plan}". Перейдите на Pro или Business.`,
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
