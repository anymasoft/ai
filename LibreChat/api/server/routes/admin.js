'use strict';
const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { User, Balance, Payment, Subscription, Plan, TokenPackage, AiModel } = require('~/db/models');
const { invalidatePlanCache } = require('../middleware/checkSubscription');
const { getEndpointsConfig } = require('~/server/services/Config');

const YUKASSA_API = 'https://api.yookassa.ru/v3';
function yukassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_API_KEY;
  if (!shopId || !secretKey) throw new Error('YOOKASSA_SHOP_ID и YOOKASSA_API_KEY не заданы');
  return { username: shopId, password: secretKey };
}

const router = express.Router();

/** Проверяет что пользователь ADMIN */
function requireAdminRole(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

/**
 * GET /api/admin/users
 * Список всех пользователей с балансами
 */
router.get('/users', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}, 'email name role createdAt emailVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    const userIds = users.map((u) => u._id);
    const [balances, subscriptions] = await Promise.all([
      Balance.find({ user: { $in: userIds } }, 'user tokenCredits').lean(),
      Subscription.find({ userId: { $in: userIds } }, 'userId plan planExpiresAt').lean(),
    ]);
    const balanceMap = Object.fromEntries(balances.map((b) => [b.user.toString(), b.tokenCredits]));
    const subMap = Object.fromEntries(subscriptions.map((s) => [s.userId.toString(), s]));

    const now = new Date();
    const result = users.map((u) => {
      const tokenCredits = balanceMap[u._id.toString()] ?? 0;
      const sub = subMap[u._id.toString()];
      let plan = sub?.plan || 'free';
      let planExpiresAt = sub?.planExpiresAt || null;
      // Учитываем истёкшую подписку
      if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < now) {
        plan = 'free';
        planExpiresAt = null;
      }
      return { ...u, tokenCredits, plan, planExpiresAt };
    });

    res.json({ users: result, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[admin/users]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/admin/users/:userId/role
 * Обновить роль пользователя: { role: 'ADMIN' | 'USER' }
 */
router.patch('/users/:userId/role', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'USER'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль. Используйте ADMIN или USER' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true, select: 'email name role' },
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    logger.info(`[admin] ${req.user.email} изменил роль ${user.email} → ${role}`);
    res.json({ user });
  } catch (err) {
    logger.error('[admin/role]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/admin/users/:userId/plan
 * Вручную переключить тариф: { plan: 'free' | 'pro' | 'business', durationDays?: number }
 * durationDays по умолчанию 30.
 */
router.patch('/users/:userId/plan', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { plan, durationDays } = req.body;
    if (!['free', 'pro', 'business'].includes(plan)) {
      return res.status(400).json({ error: 'Недопустимый тариф. Используйте free, pro или business' });
    }
    const userId = req.params.userId;
    const days = parseInt(durationDays) || 30;

    let planStartedAt = null;
    let planExpiresAt = null;

    if (plan !== 'free') {
      const now = new Date();
      planStartedAt = now;
      planExpiresAt = new Date(now);
      planExpiresAt.setDate(planExpiresAt.getDate() + days);
    }

    await Subscription.findOneAndUpdate(
      { userId },
      { plan, planStartedAt, planExpiresAt },
      { upsert: true, new: true },
    );

    logger.info(`[admin] ${req.user.email} переключил план userId=${userId} → ${plan} (до ${planExpiresAt || 'бессрочно'})`);
    res.json({ ok: true, plan, planExpiresAt });
  } catch (err) {
    logger.error('[admin/plan]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/users/:userId/balance
 * Начислить или списать баланс: { credits: number }
 * credits может быть отрицательным (списание). Итог не может быть < 0.
 */
router.post('/users/:userId/balance', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const credits = parseInt(req.body.credits);
    if (isNaN(credits) || credits === 0 || Math.abs(credits) > 100_000_000) {
      return res.status(400).json({ error: 'credits должен быть ненулевым числом (от -100000000 до 100000000)' });
    }

    // Проверяем, что итоговый баланс не уйдёт в минус
    const current = await Balance.findOne({ user: req.params.userId }, 'tokenCredits').lean();
    const currentCredits = current?.tokenCredits ?? 0;
    if (currentCredits + credits < 0) {
      return res.status(400).json({
        error: `Итоговый баланс не может быть отрицательным. Текущий: ${currentCredits}, изменение: ${credits}`,
      });
    }

    const balance = await Balance.findOneAndUpdate(
      { user: req.params.userId },
      { $inc: { tokenCredits: credits } },
      { upsert: true, new: true },
    ).lean();

    logger.info(`[admin] ${req.user.email} изменил баланс пользователя ${req.params.userId} на ${credits} (итого: ${balance.tokenCredits})`);
    res.json({ tokenCredits: balance.tokenCredits });
  } catch (err) {
    logger.error('[admin/balance]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/payments
 * Список всех платежей (ЮKassa) с фильтрами по email и дате
 */
router.get('/payments', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { email, from, to } = req.query;
    const paymentFilter = {};

    if (from || to) {
      paymentFilter.createdAt = {};
      if (from) paymentFilter.createdAt.$gte = new Date(from);
      if (to) paymentFilter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    if (email) {
      const matchedUsers = await User.find(
        { email: { $regex: email, $options: 'i' } },
        '_id',
      ).lean();
      paymentFilter.userId = { $in: matchedUsers.map((u) => u._id) };
    }

    const payments = await Payment.find(paymentFilter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('userId', 'email name')
      .lean();

    const result = payments.map((p) => ({
      _id: p._id,
      email: p.userId?.email || '—',
      name: p.userId?.name || '',
      packageId: p.packageId,
      tokenCredits: p.tokenCredits,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt,
    }));

    const totalSum = payments.reduce((sum, p) => {
      const val = parseFloat(p.amount || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    res.json({ payments: result, total: result.length, totalSum });
  } catch (err) {
    logger.error('[admin/payments]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/payments/:paymentId/reconcile
 * Проверяет платёж в ЮKassa и зачисляет кредиты, если он успешен и ещё не обработан.
 * Используется при пропаже вебхука (тест-среды, временные сбои).
 */
router.post('/payments/:paymentId/reconcile', requireJwtAuth, requireAdminRole, async (req, res) => {
  const { paymentId } = req.params;
  try {
    // Уже обработан?
    const existing = await Payment.findOne({ externalPaymentId: paymentId }).lean();
    if (existing && existing.status === 'succeeded') {
      return res.json({ ok: false, message: `Платёж уже обработан: +${existing.tokenCredits} токенов пользователю ${existing.userId}` });
    }

    // Запрашиваем статус в ЮKassa
    const { data: payment } = await axios.get(`${YUKASSA_API}/payments/${paymentId}`, {
      auth: yukassaAuth(),
    });

    if (payment.status !== 'succeeded') {
      return res.json({ ok: false, message: `Платёж в статусе "${payment.status}", не succeeded — зачисление невозможно` });
    }

    const { userId, tokenCredits, packageId } = payment.metadata || {};
    if (!userId || !tokenCredits) {
      return res.status(400).json({ error: 'В metadata платежа нет userId или tokenCredits' });
    }

    const creditsNum = parseInt(tokenCredits);
    if (!creditsNum || creditsNum <= 0) {
      return res.status(400).json({ error: `Некорректное значение tokenCredits: ${tokenCredits}` });
    }

    const updatedBalance = await Balance.findOneAndUpdate(
      { user: userId },
      { $inc: { tokenCredits: creditsNum } },
      { upsert: true, new: true },
    );

    await Payment.findOneAndUpdate(
      { externalPaymentId: paymentId },
      { userId, packageId, tokenCredits: creditsNum, amount: payment.amount?.value ?? '', status: 'succeeded' },
      { upsert: true },
    );

    logger.info(`[admin/reconcile] ${req.user.email} вручную зачислил ${creditsNum} credits userId=${userId} paymentId=${paymentId}`);
    res.json({ ok: true, message: `Зачислено ${creditsNum.toLocaleString('ru-RU')} токенов. Новый баланс: ${updatedBalance.tokenCredits.toLocaleString('ru-RU')}` });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[admin/reconcile]', msg);
    res.status(500).json({ error: `Ошибка: ${msg}` });
  }
});

// ═══════════════════════════════════════════════════════
// УПРАВЛЕНИЕ ТАРИФАМИ
// ═══════════════════════════════════════════════════════

/**
 * GET /api/admin/mvp/plans
 * Список всех тарифных планов.
 */
router.get('/plans', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    await Plan.seedDefaults();
    await TokenPackage.seedDefaults();
    const [plans, tokenPackages] = await Promise.all([
      Plan.find({}).sort({ priceRub: 1 }).lean(),
      TokenPackage.find({}).lean(),
    ]);
    res.json({ plans, tokenPackages });
  } catch (err) {
    logger.error('[admin/plans]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/admin/mvp/plans/:planId
 * Обновить тарифный план: { priceRub?, tokenCreditsOnPurchase?, allowedModels?, isActive? }
 *
 * Валидация:
 *  - Нельзя деактивировать free план
 *  - priceRub >= 0 (для free — должен быть 0)
 *  - tokenCreditsOnPurchase >= 0
 *  - Для free: allowedModels должен содержать хотя бы 1 модель
 */
router.patch('/plans/:planId', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { planId } = req.params;
    if (!['free', 'pro', 'business'].includes(planId)) {
      return res.status(400).json({ error: 'Недопустимый planId' });
    }

    const { priceRub, tokenCreditsOnPurchase, allowedModels, isActive } = req.body;
    const update = {};

    if (priceRub !== undefined) {
      const price = parseFloat(priceRub);
      if (isNaN(price) || price < 0) return res.status(400).json({ error: 'priceRub должен быть >= 0' });
      if (planId === 'free' && price !== 0) return res.status(400).json({ error: 'Тариф free должен стоить 0 ₽' });
      if (planId !== 'free' && price < 100) return res.status(400).json({ error: 'Минимальная цена для платного тарифа — 100 ₽' });
      update.priceRub = price;
    }

    if (tokenCreditsOnPurchase !== undefined) {
      const tc = parseInt(tokenCreditsOnPurchase);
      if (isNaN(tc) || tc < 0) return res.status(400).json({ error: 'tokenCreditsOnPurchase должен быть >= 0' });
      update.tokenCreditsOnPurchase = tc;
    }

    if (allowedModels !== undefined) {
      if (!Array.isArray(allowedModels)) return res.status(400).json({ error: 'allowedModels должен быть массивом строк' });
      if (planId === 'free' && allowedModels.length === 0) {
        return res.status(400).json({ error: 'Для тарифа free нельзя оставлять список моделей пустым' });
      }
      const cleanedModels = allowedModels.map((m) => String(m).trim()).filter(Boolean);
      // Валидация: все modelId должны существовать в коллекции AiModel
      if (cleanedModels.length > 0) {
        const existingModels = await AiModel.find({ modelId: { $in: cleanedModels } }, 'modelId').lean();
        const existingIds = new Set(existingModels.map((m) => m.modelId));
        const unknown = cleanedModels.filter((id) => !existingIds.has(id));
        if (unknown.length > 0) {
          return res.status(400).json({
            error: `Неизвестные modelId: ${unknown.join(', ')}. Сначала добавьте модели в каталог.`,
          });
        }
      }
      update.allowedModels = cleanedModels;
    }

    if (isActive !== undefined) {
      if (planId === 'free' && isActive === false) {
        return res.status(400).json({ error: 'Нельзя деактивировать тариф free' });
      }
      update.isActive = Boolean(isActive);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    const updated = await Plan.findOneAndUpdate({ planId }, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Тариф не найден' });

    invalidatePlanCache(); // Немедленно применяем изменение allowedModels

    logger.info(`[admin/plans] ${req.user.email} обновил тариф "${planId}": ${JSON.stringify(update)}`);
    res.json({ ok: true, plan: updated });
  } catch (err) {
    logger.error('[admin/plans/update]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/admin/mvp/token-packages/:packageId
 * Обновить пакет токенов: { priceRub?, tokenCredits?, isActive? }
 */
router.patch('/token-packages/:packageId', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { packageId } = req.params;
    await TokenPackage.seedDefaults();

    const { priceRub, tokenCredits, isActive } = req.body;
    const update = {};

    if (priceRub !== undefined) {
      const price = parseFloat(priceRub);
      if (isNaN(price) || price < 100) return res.status(400).json({ error: 'Минимальная цена пакета — 100 ₽' });
      update.priceRub = price;
    }

    if (tokenCredits !== undefined) {
      const tc = parseInt(tokenCredits);
      if (isNaN(tc) || tc <= 0) return res.status(400).json({ error: 'tokenCredits должен быть > 0' });
      update.tokenCredits = tc;
    }

    if (isActive !== undefined) {
      update.isActive = Boolean(isActive);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    const updated = await TokenPackage.findOneAndUpdate({ packageId }, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Пакет не найден' });

    logger.info(`[admin/token-packages] ${req.user.email} обновил пакет "${packageId}": ${JSON.stringify(update)}`);
    res.json({ ok: true, package: updated });
  } catch (err) {
    logger.error('[admin/token-packages/update]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ═══════════════════════════════════════════════════════
// УПРАВЛЕНИЕ КАТАЛОГОМ МОДЕЛЕЙ (AiModel)
// ═══════════════════════════════════════════════════════

/**
 * GET /api/admin/mvp/models
 * Список всех моделей из каталога (активных и неактивных).
 */
router.get('/models', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const models = await AiModel.find({})
      .sort({ provider: 1, displayName: 1 })
      .lean();
    res.json({ models });
  } catch (err) {
    logger.error('[admin/models]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/mvp/models
 * Создать новую модель: { modelId, provider, endpointKey, displayName, isActive? }
 *
 * endpointKey — имя LibreChat-эндпоинта ('openAI', 'anthropic', 'deepseek', …)
 * Если не указан, выводится автоматически из provider:
 *   'openai' → 'openAI', остальные — совпадают с provider.
 */
router.post('/models', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { modelId, provider, displayName, endpointKey, isActive = true } = req.body;
    if (!modelId || typeof modelId !== 'string' || !modelId.trim()) {
      return res.status(400).json({ error: 'modelId обязателен' });
    }
    if (!provider || typeof provider !== 'string' || !provider.trim()) {
      return res.status(400).json({ error: 'provider обязателен' });
    }
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ error: 'displayName обязателен' });
    }

    // Выводим endpointKey из provider, если не задан явно
    const resolvedEndpoint = endpointKey?.trim()
      || (provider.trim().toLowerCase() === 'openai' ? 'openAI' : provider.trim());

    // Валидация: проверяем, что эндпоинт настроен в конфиге
    const endpointsConfig = await getEndpointsConfig(req);
    if (!endpointsConfig || !endpointsConfig[resolvedEndpoint]) {
      const availableEndpoints = Object.keys(endpointsConfig || {}).join(', ');
      return res.status(400).json({
        error: `Эндпоинт "${resolvedEndpoint}" не настроен. Доступные эндпоинты: ${availableEndpoints || 'нет'}`,
      });
    }

    const exists = await AiModel.findOne({ modelId: modelId.trim() }).lean();
    if (exists) {
      return res.status(409).json({ error: `Модель с modelId "${modelId.trim()}" уже существует` });
    }

    const model = await AiModel.create({
      modelId: modelId.trim(),
      provider: provider.trim(),
      endpointKey: resolvedEndpoint,
      displayName: displayName.trim(),
      isActive: Boolean(isActive),
    });

    logger.info(`[admin/models] ${req.user.email} создал модель "${model.modelId}" (endpoint: ${resolvedEndpoint})`);
    res.status(201).json({ ok: true, model });
  } catch (err) {
    logger.error('[admin/models/create]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/admin/mvp/models/:modelId
 * Обновить модель: { provider?, endpointKey?, displayName?, isActive? }
 * modelId менять нельзя (это первичный ключ).
 *
 * Если isActive=false — модель каскадно удаляется из Plans.allowedModels
 * и кэш планов инвалидируется немедленно.
 */
router.patch('/models/:modelId', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { provider, endpointKey, displayName, isActive } = req.body;
    const update = {};

    if (provider !== undefined) {
      if (typeof provider !== 'string' || !provider.trim()) return res.status(400).json({ error: 'provider не может быть пустым' });
      update.provider = provider.trim();
    }
    if (endpointKey !== undefined) {
      if (typeof endpointKey !== 'string' || !endpointKey.trim()) return res.status(400).json({ error: 'endpointKey не может быть пустым' });
      const newEndpoint = endpointKey.trim();

      // Валидация: проверяем, что новый эндпоинт настроен в конфиге
      const endpointsConfig = await getEndpointsConfig(req);
      if (!endpointsConfig || !endpointsConfig[newEndpoint]) {
        const availableEndpoints = Object.keys(endpointsConfig || {}).join(', ');
        return res.status(400).json({
          error: `Эндпоинт "${newEndpoint}" не настроен. Доступные эндпоинты: ${availableEndpoints || 'нет'}`,
        });
      }

      update.endpointKey = newEndpoint;
    }
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) return res.status(400).json({ error: 'displayName не может быть пустым' });
      update.displayName = displayName.trim();
    }
    if (isActive !== undefined) {
      update.isActive = Boolean(isActive);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    const updated = await AiModel.findOneAndUpdate({ modelId }, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Модель не найдена' });

    // Если модель деактивирована — каскадно убираем её из всех тарифных планов
    if (update.isActive === false) {
      const pullResult = await Plan.updateMany(
        { allowedModels: modelId },
        { $pull: { allowedModels: modelId } },
      );
      if (pullResult.modifiedCount > 0) {
        invalidatePlanCache();
        logger.info(`[admin/models] Модель "${modelId}" деактивирована и удалена из ${pullResult.modifiedCount} тарифных планов`);
      }
    }

    logger.info(`[admin/models] ${req.user.email} обновил модель "${modelId}": ${JSON.stringify(update)}`);
    res.json({ ok: true, model: updated });
  } catch (err) {
    logger.error('[admin/models/update]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/admin/mvp/models/:modelId
 * Удалить модель.
 * Каскадно удаляет modelId из allowedModels всех тарифных планов.
 * После удаления инвалидирует кэш планов.
 */
router.delete('/models/:modelId', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { modelId } = req.params;

    const model = await AiModel.findOne({ modelId }).lean();
    if (!model) return res.status(404).json({ error: 'Модель не найдена' });

    // Каскадное удаление из всех планов
    const pullResult = await Plan.updateMany(
      { allowedModels: modelId },
      { $pull: { allowedModels: modelId } },
    );

    await AiModel.deleteOne({ modelId });

    // Инвалидируем кэш планов, если модель была в каком-либо плане
    if (pullResult.modifiedCount > 0) {
      invalidatePlanCache();
    }

    logger.info(
      `[admin/models] ${req.user.email} удалил модель "${modelId}". ` +
      `Удалена из ${pullResult.modifiedCount} тарифных планов.`,
    );
    res.json({ ok: true, removedFromPlans: pullResult.modifiedCount });
  } catch (err) {
    logger.error('[admin/models/delete]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
