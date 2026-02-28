'use strict';
/**
 * checkSubscription middleware
 *
 * 1. Ленивая проверка срока подписки: если истёк → понижаем до free в БД.
 * 2. Проверка доступа к модели по плану (free → только gpt-4o-mini).
 * 3. Прикрепляет req.subscription = { plan, planExpiresAt } для downstream.
 */
const { Subscription } = require('~/db/models');
const { isModelAllowed } = require('../utils/subscriptionConfig');

async function checkSubscription(req, res, next) {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;
    if (!userId) return next();

    let subscription = await Subscription.findOne({ userId }).lean();

    let plan = subscription?.plan || 'free';
    let planExpiresAt = subscription?.planExpiresAt || null;

    // Ленивое истечение: понижаем до free если срок вышел
    if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
      await Subscription.findOneAndUpdate(
        { userId },
        { plan: 'free', planExpiresAt: null, planStartedAt: null },
      );
      plan = 'free';
      planExpiresAt = null;
    }

    req.subscription = { plan, planExpiresAt };

    // Проверка доступа к модели
    const modelName =
      req.body?.model ||
      req.body?.endpointOption?.model ||
      req.body?.endpointOption?.modelOptions?.model ||
      null;

    if (modelName && !isModelAllowed(plan, modelName)) {
      return res.status(403).json({
        error: `Модель "${modelName}" недоступна на плане "${plan}". Перейдите на Pro или Business.`,
        code: 'MODEL_NOT_ALLOWED',
      });
    }

    next();
  } catch (err) {
    // Не блокируем запрос при ошибке проверки подписки
    next();
  }
}

module.exports = checkSubscription;
