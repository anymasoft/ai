'use strict';
/**
 * Единый источник истины по конфигурации подписок.
 * Используется в payment.js, checkSubscription middleware, Balance controller, admin.js и фронтенде.
 *
 * Расчёт токенов (маржа ~50%, курс 90 ₽/$):
 *   Pro  (3 990 ₽ = $44.3): API-бюджет $22.2 → 22 000 000 TC
 *   Business (9 990 ₽ = $111): API-бюджет $55.5 → 55 000 000 TC
 *   1 TC = $0.000001 (1 микродоллар)
 */

/** Средняя стоимость одного сообщения в TC (mix 40% GPT-4o Mini / 50% Claude Sonnet / 10% DeepSeek) */
const AVG_MSG_CREDITS = 4_392;

/** Перевод tokenCredits → оценка количества сообщений */
function creditsToMessages(credits) {
  return Math.max(0, Math.floor(credits / AVG_MSG_CREDITS));
}

const PLAN_CONFIGS = {
  free: {
    label: 'Free',
    priceRub: 0,
    tokenCredits: 0,        // стартовый баланс начисляется при регистрации через appConfig.balance
    durationDays: null,     // бессрочно
    /** null = все модели; массив = только модели, содержащие одну из строк */
    allowedModelPatterns: ['gpt-4o-mini'],
  },
  pro: {
    label: 'Pro',
    priceRub: 3_990,
    tokenCredits: 22_000_000,
    durationDays: 30,
    allowedModelPatterns: null,   // все модели разрешены
  },
  business: {
    label: 'Business',
    priceRub: 9_990,
    tokenCredits: 55_000_000,
    durationDays: 30,
    allowedModelPatterns: null,   // все модели разрешены
  },
};

/** YooKassa packageId → { plan, tokenCredits, amount, type, durationDays } */
const PACKAGES = {
  pro: {
    amount: '3990.00',
    tokenCredits: PLAN_CONFIGS.pro.tokenCredits,
    plan: 'pro',
    type: 'subscription',
    durationDays: PLAN_CONFIGS.pro.durationDays,
  },
  max: {
    amount: '9990.00',
    tokenCredits: PLAN_CONFIGS.business.tokenCredits,
    plan: 'business',
    type: 'subscription',
    durationDays: PLAN_CONFIGS.business.durationDays,
  },
};

/**
 * Проверяет, разрешена ли модель для данного плана.
 * @param {'free'|'pro'|'business'} plan
 * @param {string} modelName
 */
function isModelAllowed(plan, modelName) {
  const cfg = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;
  if (!cfg.allowedModelPatterns) return true;          // null = все разрешены
  if (!modelName) return true;                          // модель не указана — пропускаем
  return cfg.allowedModelPatterns.some((p) => modelName.toLowerCase().includes(p));
}

module.exports = { PLAN_CONFIGS, PACKAGES, AVG_MSG_CREDITS, creditsToMessages, isModelAllowed };
