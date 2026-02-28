'use strict';
/**
 * ЮKassa payment integration
 *
 * Env vars (.env):
 *   YOOKASSA_SHOP_ID   — shopId из кабинета ЮKassa
 *   YOOKASSA_API_KEY   — секретный ключ магазина
 *   YOOKASSA_RETURN_URL — URL возврата (по умолчанию /pricing?payment=success)
 *
 * Поллинг для localhost:
 *   PROD → webhook /api/payment/webhook (ЮKassa отправляет сама)
 *   LOCAL → GET /api/payment/check (frontend вызывает после редиректа с ?payment=success)
 */
const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { Balance, Payment, Subscription } = require('~/db/models');
const { PACKAGES, PLAN_CONFIGS } = require('../utils/subscriptionConfig');

const router = express.Router();

const YUKASSA_API = 'https://api.yookassa.ru/v3';

function yukassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_API_KEY;
  if (!shopId || !secretKey) {
    throw new Error('YOOKASSA_SHOP_ID и YOOKASSA_API_KEY должны быть заданы в .env');
  }
  return { username: shopId, password: secretKey };
}

/**
 * Обновляет подписку пользователя согласно правилам продления/апгрейда:
 * - Продление (тот же план, ещё активен): planExpiresAt += durationDays
 * - Апгрейд или новая подписка: planStartedAt = now, planExpiresAt = now + durationDays
 */
async function upsertSubscription(userId, plan, durationDays) {
  const now = new Date();
  const existing = await Subscription.findOne({ userId }).lean();

  let baseDate = now; // по умолчанию отсчёт от сейчас
  // Продление: тот же план, ещё не истёк → продлеваем от текущего planExpiresAt
  if (
    existing &&
    existing.plan === plan &&
    existing.planExpiresAt &&
    new Date(existing.planExpiresAt) > now
  ) {
    baseDate = new Date(existing.planExpiresAt);
  }

  const planExpiresAt = new Date(baseDate);
  planExpiresAt.setDate(planExpiresAt.getDate() + durationDays);

  return Subscription.findOneAndUpdate(
    { userId },
    { plan, planStartedAt: now, planExpiresAt },
    { upsert: true, new: true },
  ).lean();
}

/**
 * Общая идемпотентная функция активации успешного платежа.
 * Вызывается из webhook И из /check (fallback для localhost).
 */
async function applySuccessfulPayment(externalPaymentId) {
  const existing = await Payment.findOne({ externalPaymentId }).lean();

  if (existing && existing.status === 'succeeded') {
    return { ok: true, alreadyDone: true, message: 'Платёж уже был обработан ранее' };
  }
  if (!existing || existing.status !== 'pending') {
    return { ok: false, message: `Платёж не найден или статус: ${existing?.status}` };
  }

  const { userId, tokenCredits: creditsRaw, planPurchased, type } = existing;
  const creditsNum = parseInt(creditsRaw);
  if (!creditsNum || creditsNum <= 0) {
    return { ok: false, message: `Некорректное значение tokenCredits: ${creditsRaw}` };
  }

  // 1. Добавляем токены на баланс
  const updatedBalance = await Balance.findOneAndUpdate(
    { user: userId },
    { $inc: { tokenCredits: creditsNum } },
    { upsert: true, new: true },
  );

  // 2. Обновляем подписку (если это subscription-тип)
  let subscription = null;
  if (type === 'subscription' && planPurchased) {
    const cfg = PLAN_CONFIGS[planPurchased];
    if (cfg?.durationDays) {
      subscription = await upsertSubscription(userId, planPurchased, cfg.durationDays);
    }
  }

  // 3. Помечаем платёж как succeeded
  await Payment.findOneAndUpdate(
    { externalPaymentId },
    { status: 'succeeded', expiresAt: subscription?.planExpiresAt || null },
  );

  logger.info(
    `[payment/apply] userId=${userId} plan=${planPurchased} +${creditsNum} TC. ` +
    `Баланс: ${updatedBalance.tokenCredits}. Подписка до: ${subscription?.planExpiresAt || '—'}`,
  );

  return {
    ok: true,
    alreadyDone: false,
    tokenCredits: creditsNum,
    newBalance: updatedBalance.tokenCredits,
    plan: planPurchased,
    planExpiresAt: subscription?.planExpiresAt || null,
  };
}

/**
 * POST /api/payment/create
 * Body: { packageId: 'pro' | 'max' }
 */
router.post('/create', requireJwtAuth, async (req, res) => {
  try {
    const { packageId } = req.body;
    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return res.status(400).json({ error: `Неизвестный пакет: ${packageId}` });
    }

    const userId = req.user._id.toString();
    const idempotenceKey = `${userId}-${packageId}-${Date.now()}`;

    const returnUrl =
      process.env.YOOKASSA_RETURN_URL ||
      `${process.env.DOMAIN_CLIENT || 'http://localhost:3080'}/pricing?payment=success`;

    const auth = yukassaAuth();
    const { data } = await axios.post(
      `${YUKASSA_API}/payments`,
      {
        amount: { value: pkg.amount, currency: 'RUB' },
        confirmation: { type: 'redirect', return_url: returnUrl },
        capture: true,
        description: `Подписка ${pkg.plan} — ${pkg.amount} ₽/мес`,
        metadata: { userId, packageId, tokenCredits: pkg.tokenCredits, plan: pkg.plan },
      },
      {
        auth,
        headers: { 'Idempotence-Key': idempotenceKey, 'Content-Type': 'application/json' },
      },
    );

    // Сохраняем как 'pending' — /check найдёт его при необходимости
    await Payment.findOneAndUpdate(
      { externalPaymentId: data.id },
      {
        externalPaymentId: data.id,
        userId,
        packageId,
        type: pkg.type,
        planPurchased: pkg.plan,
        tokenCredits: pkg.tokenCredits,
        amount: pkg.amount,
        status: 'pending',
      },
      { upsert: true },
    );

    logger.info(`[payment/create] userId=${userId} packageId=${packageId} paymentId=${data.id}`);
    res.json({ paymentId: data.id, confirmationUrl: data.confirmation?.confirmation_url });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[payment/create]', msg);
    res.status(500).json({ error: `Ошибка создания платежа: ${msg}` });
  }
});

/**
 * GET /api/payment/check
 * Fallback для localhost: frontend вызывает ОДИН РАЗ после ?payment=success.
 */
router.get('/check', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const pending = await Payment.findOne(
      { userId, status: 'pending' },
      null,
      { sort: { createdAt: -1 } },
    ).lean();

    if (!pending) {
      return res.json({ ok: false, status: 'not_found', message: 'Нет ожидающих платежей' });
    }

    const { data: ykPayment } = await axios.get(
      `${YUKASSA_API}/payments/${pending.externalPaymentId}`,
      { auth: yukassaAuth() },
    );

    logger.info(`[payment/check] userId=${userId} paymentId=${pending.externalPaymentId} ykStatus=${ykPayment.status}`);

    if (ykPayment.status === 'succeeded' && ykPayment.paid === true) {
      const result = await applySuccessfulPayment(pending.externalPaymentId);
      if (result.ok) {
        return res.json({
          ok: true,
          status: 'succeeded',
          alreadyDone: result.alreadyDone,
          tokenCredits: result.tokenCredits,
          newBalance: result.newBalance,
          plan: result.plan,
          planExpiresAt: result.planExpiresAt,
        });
      }
      return res.json({ ok: false, status: 'error', message: result.message });
    }

    if (ykPayment.status === 'canceled') {
      await Payment.findOneAndUpdate({ externalPaymentId: pending.externalPaymentId }, { status: 'failed' });
      return res.json({ ok: false, status: 'canceled', message: 'Платёж отменён' });
    }

    return res.json({ ok: false, status: ykPayment.status, message: 'Платёж ещё обрабатывается' });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[payment/check]', msg);
    res.status(500).json({ ok: false, error: `Ошибка проверки: ${msg}` });
  }
});

/**
 * POST /api/payment/webhook
 * ЮKassa отправляет при изменении статуса (только PROD/staging).
 */
router.post('/webhook', express.json(), async (req, res) => {
  res.sendStatus(200);
  try {
    const event = req.body;
    if (!event || event.type !== 'notification') return;

    const payment = event.object;
    if (!payment || payment.status !== 'succeeded') return;

    const { userId, tokenCredits, packageId, plan } = payment.metadata || {};
    if (userId && tokenCredits && packageId) {
      const pkg = PACKAGES[packageId] || {};
      await Payment.findOneAndUpdate(
        { externalPaymentId: payment.id },
        {
          $setOnInsert: {
            externalPaymentId: payment.id,
            userId,
            packageId,
            type: pkg.type || 'subscription',
            planPurchased: plan || pkg.plan || null,
            tokenCredits: parseInt(tokenCredits),
            amount: payment.amount?.value ?? '',
          },
          $set: { status: 'pending' },
        },
        { upsert: true },
      );
    }

    const result = await applySuccessfulPayment(payment.id);
    if (!result.ok && !result.alreadyDone) {
      logger.warn(`[payment/webhook] apply failed: ${result.message}`);
    }
  } catch (err) {
    logger.error('[payment/webhook]', err);
  }
});

/**
 * GET /api/payment/history
 */
router.get('/history', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = parseInt(req.query.offset) || 0;
    const payments = await Payment.find({ userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    const total = await Payment.countDocuments({ userId });
    res.json({ payments, total, limit, offset });
  } catch (err) {
    logger.error('[payment/history]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
