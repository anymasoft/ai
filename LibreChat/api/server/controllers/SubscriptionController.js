'use strict';
/**
 * SubscriptionController — Единый источник истины для тарифа пользователя
 * Возвращает полную информацию о подписке пользователя:
 * - planId (free, pro, business)
 * - planName (читаемое имя)
 * - allowedModels (модели, доступные на этом плане)
 * - expiresAt (дата истечения подписки)
 * - features (ограничения и возможности плана)
 *
 * ⚠️ ВАЖНО: Это ЕДИНСТВЕННЫЙ источник информации о плане в UI.
 * Все компоненты должны использовать только этот endpoint.
 */

const Subscription = require('~/models/Subscription');
const Plan = require('~/models/Plan');

async function getSubscription(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // ✅ ВСЕГДА читаем из БД (БЕЗ in-memory кэша)
    const subscription = await Subscription.findOne({ userId }).lean();
    let planId = subscription?.plan || 'free';
    let planExpiresAt = subscription?.planExpiresAt || null;

    // ✅ Автоматическое понижение плана если истёк
    if (planId !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
      planId = 'free';
      planExpiresAt = null;
    }

    // ✅ Получаем конфигурацию плана (allowedModels, features)
    await Plan.seedDefaults();
    const planDoc = await Plan.findOne({ planId }).lean();

    if (!planDoc) {
      return res.status(500).json({ error: 'Plan configuration not found' });
    }

    // ✅ Возвращаем полную информацию о подписке
    const response = {
      planId,
      planKey: planId,                    // Для backward compat
      planName: planDoc.label || planId,
      description: planDoc.description || '',
      expiresAt: planExpiresAt,
      allowedModels: planDoc.allowedModels || [],
      allowedSpecs: planDoc.allowedSpecs || [],
      tokenCreditsOnPurchase: planDoc.tokenCreditsOnPurchase || 0,
      durationDays: planDoc.durationDays || null,
      isActive: planDoc.isActive !== false,
      features: {
        webSearch: planId !== 'free',
        codeInterpreter: planId !== 'free',
        prioritySupport: planId === 'business',
      },
    };

    // ✅ НЕ КЭШИРУЕМ! staleTime=0 на фронтенде означает что сервер должен отвечать всегда
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json(response);
  } catch (err) {
    const { logger } = require('@librechat/data-schemas');
    logger.error('[SubscriptionController] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = getSubscription;
