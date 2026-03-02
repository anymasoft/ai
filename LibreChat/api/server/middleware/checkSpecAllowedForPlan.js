'use strict';
/**
 * checkSpecAllowedForPlan middleware
 *
 * Проверяет, что выбранный spec разрешён на тарифном плане пользователя.
 * Используется в spec-driven архитектуре LibreChat.
 *
 * allowedSpecs:
 *   []                                = все spec разрешены
 *   ['claude-haiku-4-5', '...']       = строгое совпадение по spec.name (exact match)
 *
 * allowedSpecs хранит spec.name из librechat.yaml (modelSpecs.list).
 * Substring-matching ЗАПРЕЩЁН — только includes() для exact match.
 *
 * Порядок в middleware цепочке:
 * 1. authenticateUser
 * 2. checkSubscription (проверка срока подписки)
 * 3. checkSpecAllowedForPlan ← ЗДЕСЬ (проверка доступа к spec)
 * 4. buildEndpointOption (преобразование spec → endpoint+model)
 */

const { Subscription, Plan } = require('~/db/models');

// Кэш планов — обновляется раз в 60 секунд, чтобы не ходить в БД на каждый запрос
let _planCache = null;
let _cacheExpiresAt = 0;
const CACHE_TTL = 60_000;

async function getPlans() {
  if (_planCache && Date.now() < _cacheExpiresAt) return _planCache;
  await Plan.seedDefaults();
  const plans = await Plan.find({}, 'planId allowedSpecs isActive').lean();
  _planCache = Object.fromEntries(plans.map((p) => [p.planId, p]));
  _cacheExpiresAt = Date.now() + CACHE_TTL;
  return _planCache;
}

/** Вызывать после обновления планов в admin, чтобы сразу применились новые allowedSpecs. */
function invalidatePlanCache() {
  _planCache = null;
}

function isSpecAllowed(planConfig, specName) {
  if (!planConfig || !specName) return true;
  const allowed = planConfig.allowedSpecs || [];
  if (allowed.length === 0) return true;        // пустой = все spec разрешены
  return allowed.includes(specName);            // exact match по spec.name
}

async function checkSpecAllowedForPlan(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id; // ObjectId для поиска
    if (!userId) return next();

    const subscription = await Subscription.findOne({ userId }).lean();
    let plan = subscription?.plan || 'free';

    // Получить spec из payload
    const spec = req.body?.spec;

    // Если spec не передан, пропустить проверку (это может быть OK)
    if (!spec) {
      return next();
    }

    // [SPEC CHECK] Log exactly where the spec comes from
    if (spec) {
      const { logger } = require('@librechat/data-schemas');
      logger.info(`[SPEC CHECK] "${spec}" against plan "${plan}"`, {
        spec,
        plan,
        userId,
      });

      const plans = await getPlans();
      const planConfig = plans[plan];

      if (!isSpecAllowed(planConfig, spec)) {
        return res.status(403).json({
          error: `Spec "${spec}" недоступна на плане "${plan}". Перейдите на Pro или Business.`,
          code: 'SPEC_NOT_ALLOWED',
          allowedSpecs: planConfig?.allowedSpecs || [],
        });
      }
    }

    next();
  } catch (err) {
    const { logger } = require('@librechat/data-schemas');
    logger.error('[SPEC CHECK] Error checking spec:', err);
    next();
  }
}

module.exports = checkSpecAllowedForPlan;
module.exports.invalidatePlanCache = invalidatePlanCache;
