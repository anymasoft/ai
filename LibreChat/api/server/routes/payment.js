'use strict';
/**
 * ЮKassa payment integration
 *
 * Env vars (.env):
 *   YOOKASSA_SHOP_ID    — shopId из кабинета ЮKassa
 *   YOOKASSA_API_KEY    — секретный ключ магазина
 *   YOOKASSA_RETURN_URL — URL возврата (по умолчанию /pricing?payment=success)
 *
 * Поллинг для localhost:
 *   PROD  → webhook /api/payment/webhook (ЮKassa отправляет сама)
 *   LOCAL → GET /api/payment/check (frontend вызывает после редиректа с ?payment=success)
 *
 * Типы платежей:
 *   'subscription' — меняет plan и plan_expires_at
 *   'token_pack'   — только пополняет баланс, plan не трогает
 */
const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { Balance } = require('~/db/models');
const Payment = require('~/models/Payment');
const Subscription = require('~/models/Subscription');
const Plan = require('~/models/Plan');
const TokenPackage = require('~/models/TokenPackage');
const { invalidatePlanCache } = require('../middleware/checkSubscription');

const router = express.Router();
const YUKASSA_API = 'https://api.yookassa.ru/v3';

function yukassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_API_KEY;
  if (!shopId || !secretKey) throw new Error('YOOKASSA_SHOP_ID и YOOKASSA_API_KEY должны быть заданы в .env');
  return { username: shopId, password: secretKey };
}

async function ensureSeeded() {
  await Promise.all([Plan.seedDefaults(), TokenPackage.seedDefaults()]);
}

async function upsertSubscription(userId, planId, durationDays, session = null) {
  const now = new Date();
  // Опция: можно использовать session если передан (для transactions)
  const findOptions = session ? { session } : {};
  const existing = await Subscription.findOne({ userId }, null, findOptions).lean();

  let baseDate = now;
  if (
    existing &&
    existing.plan === planId &&
    existing.planExpiresAt &&
    new Date(existing.planExpiresAt) > now
  ) {
    baseDate = new Date(existing.planExpiresAt);
  }

  const planExpiresAt = new Date(baseDate);
  planExpiresAt.setDate(planExpiresAt.getDate() + durationDays);

  const updateOptions = { upsert: true, new: true };
  if (session) {
    updateOptions.session = session;
  }

  return Subscription.findOneAndUpdate(
    { userId },
    { plan: planId, planStartedAt: now, planExpiresAt },
    updateOptions,
  ).lean();
}

async function applySuccessfulPayment(externalPaymentId) {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    // ВАЖНО: Проверка idempotency ПЕРЕД транзакцией (для экономии ресурсов)
    const existing = await Payment.findOne({ externalPaymentId }).lean();
    logger.debug(`[payment/apply] Found payment: ${externalPaymentId}, status=${existing?.status}`);

    if (existing && existing.status === 'succeeded') {
      await session.endSession();
      logger.info(`[payment/apply] Payment already succeeded: ${externalPaymentId}`);
      return { ok: true, alreadyDone: true, message: 'Платёж уже был обработан ранее' };
    }
    if (!existing || existing.status !== 'pending') {
      await session.endSession();
      logger.warn(`[payment/apply] Invalid payment state: ${externalPaymentId}, status=${existing?.status}`);
      return { ok: false, message: `Платёж не найден или статус: ${existing?.status}` };
    }

    const { userId, tokenCredits: creditsRaw, planPurchased, type } = existing;
    const creditsNum = parseInt(creditsRaw);
    if (!creditsNum || creditsNum <= 0) {
      await session.endSession();
      logger.warn(`[payment/apply] Invalid tokenCredits: ${creditsRaw}`);
      return { ok: false, message: `Некорректное значение tokenCredits: ${creditsRaw}` };
    }

    // ════════════════════════════════════════════════════════════════════════
    // КРИТИЧНЫЙ РАЗДЕЛ: ВСЕ ОПЕРАЦИИ В ОДНОЙ ТРАНЗАКЦИИ
    // ════════════════════════════════════════════════════════════════════════

    logger.debug(`[payment/apply] Starting transaction for payment ${externalPaymentId}`);

    // 1. Обновляем Balance АТОМАРНО
    logger.debug(`[payment/apply] Updating balance for ${userId}: +${creditsNum} TC`);
    const updatedBalance = await Balance.findOneAndUpdate(
      { user: userId },
      { $inc: { tokenCredits: creditsNum } },
      { upsert: true, new: true, session },  // ← session в каждой операции!
    );

    if (!updatedBalance) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`[payment/apply] Failed to update balance for ${userId}`);
      return { ok: false, message: 'Ошибка при обновлении баланса' };
    }

    logger.debug(`[payment/apply] Balance updated: newBalance=${updatedBalance.tokenCredits}`);

    // 2. Обновляем Subscription АТОМАРНО (если это subscription платеж)
    let subscription = null;
    if (type === 'subscription' && planPurchased) {
      logger.debug(`[payment/apply] Processing subscription: ${planPurchased}`);
      const planDoc = await Plan.findOne({ planId: planPurchased }).lean();
      if (planDoc?.durationDays) {
        // upsertSubscription теперь должна принимать session
        subscription = await upsertSubscription(userId, planPurchased, planDoc.durationDays, session);
        logger.debug(`[payment/apply] Subscription updated: expires=${subscription?.planExpiresAt}`);
      }
    }

    // 3. Обновляем Payment АТОМАРНО
    const updatedPayment = await Payment.findOneAndUpdate(
      { externalPaymentId },
      { status: 'succeeded', expiresAt: subscription?.planExpiresAt || null },
      { new: true, session },  // ← session в каждой операции!
    );

    if (!updatedPayment) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`[payment/apply] Failed to update payment status for ${externalPaymentId}`);
      return { ok: false, message: 'Ошибка при обновлении статуса платежа' };
    }

    // ════════════════════════════════════════════════════════════════════════
    // ВСЕ ОПЕРАЦИИ УСПЕШНЫ → КОММИТИМ ТРАНЗАКЦИЮ
    // ════════════════════════════════════════════════════════════════════════
    await session.commitTransaction();
    await session.endSession();

    logger.info(
      `[payment/apply] SUCCESS (ATOMIC): paymentId=${externalPaymentId} userId=${userId} type=${type} ` +
      `plan=${planPurchased || '—'} +${creditsNum} TC newBalance=${updatedBalance.tokenCredits}`,
    );

    // 🔄 ВАЖНО: Инвалидируем кеш плана в памяти для SSOT архитектуры
    if (type === 'subscription' && planPurchased) {
      if (typeof invalidatePlanCache === 'function') {
        try {
          await invalidatePlanCache(userId);
          logger.debug(`[payment/apply] Plan cache invalidated for userId=${userId}`);
        } catch (cacheErr) {
          logger.warn(`[payment/apply] Cache invalidation failed:`, cacheErr);
          // Не прерываем обработку платежа из-за ошибки кеша
        }
      }
    }

    return {
      ok: true,
      alreadyDone: false,
      tokenCredits: creditsNum,
      newBalance: updatedBalance.tokenCredits,
      plan: planPurchased,
      planExpiresAt: subscription?.planExpiresAt || null,
      cacheInvalidated: type === 'subscription' && planPurchased,
    };
  } catch (err) {
    // ОШИБКА → ОТКАТЫВАЕМ ВСЮ ТРАНЗАКЦИЮ
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      logger.error(`[payment/apply] Error aborting transaction:`, abortErr);
    }
    await session.endSession();

    logger.error(`[payment/apply] ERROR for ${externalPaymentId}:`, err);
    return { ok: false, message: `Ошибка применения платежа: ${err.message}` };
  }
}

/**
 * GET /api/payment/plans
 * Публичный эндпоинт — возвращает активные тарифы и пакеты токенов.
 * Авторизация НЕ требуется.
 */
router.get('/plans', async (req, res) => {
  try {
    await ensureSeeded();
    const [plans, tokenPackages] = await Promise.all([
      Plan.find({ isActive: true }).sort({ priceRub: 1 }).lean(),
      TokenPackage.find({ isActive: true }).lean(),
    ]);
    return res.json({ plans, tokenPackages });
  } catch (err) {
    logger.error('[payment/plans]', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/payment/create
 * Body: { packageId: string }
 *   Для подписки:   packageId = planId ('pro' | 'business')
 *   Для токен-пака: packageId = 'token_pack'
 */
router.post('/create', requireJwtAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const { packageId } = req.body;
    const userId = req.user._id; // ObjectId для поиска в БД

    const tokenPkg = await TokenPackage.findOne({ packageId, isActive: true }).lean();
    const planDoc  = tokenPkg ? null : await Plan.findOne({ planId: packageId, isActive: true }).lean();

    if (!tokenPkg && !planDoc) {
      return res.status(400).json({ error: `Неизвестный или неактивный пакет: ${packageId}` });
    }
    if (planDoc && planDoc.priceRub <= 0) {
      return res.status(400).json({ error: 'Этот тариф не требует оплаты' });
    }

    const priceRub     = tokenPkg ? tokenPkg.priceRub    : planDoc.priceRub;
    const tokenCredits = tokenPkg ? tokenPkg.tokenCredits : planDoc.tokenCreditsOnPurchase;
    const type         = tokenPkg ? 'token_pack'          : 'subscription';
    const planId       = tokenPkg ? null                  : planDoc.planId;
    const description  = tokenPkg
      ? `${tokenPkg.label} — ${priceRub} ₽`
      : `Подписка ${planDoc.label} — ${priceRub} ₽/мес`;

    const amountStr = priceRub.toFixed(2);
    const idempotenceKey = `${userId}-${packageId}-${Date.now()}`;

    const baseUrl = process.env.DOMAIN_CLIENT || `${req.protocol}://${req.get('host')}`;
    const returnUrl = process.env.YOOKASSA_RETURN_URL || `${baseUrl}/pricing?payment=success`;

    const { data } = await axios.post(
      `${YUKASSA_API}/payments`,
      {
        amount: { value: amountStr, currency: 'RUB' },
        confirmation: { type: 'redirect', return_url: returnUrl },
        capture: true,
        description,
        metadata: { userId, packageId, tokenCredits, plan: planId, type },
      },
      {
        auth: yukassaAuth(),
        headers: { 'Idempotence-Key': idempotenceKey, 'Content-Type': 'application/json' },
      },
    );

    await Payment.findOneAndUpdate(
      { externalPaymentId: data.id },
      {
        externalPaymentId: data.id,
        userId,
        packageId,
        type,
        planPurchased: planId,
        tokenCredits,
        amount: amountStr,
        status: 'pending',
      },
      { upsert: true },
    );

    logger.info(`[payment/create] userId=${userId} packageId=${packageId} type=${type} paymentId=${data.id}`);
    return res.json({ paymentId: data.id, confirmationUrl: data.confirmation?.confirmation_url });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[payment/create]', msg);
    return res.status(500).json({ error: `Ошибка создания платежа: ${msg}` });
  }
});

/**
 * GET /api/payment/check
 * Fallback для localhost: frontend вызывает ОДИН РАЗ после ?payment=success.
 */
router.get('/check', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user._id; // ObjectId для поиска в БД
    const { id: paymentId } = req.query;
    const pending = paymentId
      ? await Payment.findOne({ externalPaymentId: paymentId, userId, status: 'pending' }).lean()
      : await Payment.findOne({ userId, status: 'pending' }, null, { sort: { createdAt: -1 } }).lean();

    // 🔄 ВАЖНО: НЕ КЭШИРУЕМ ответ проверки платежа (может измениться на следующий запрос)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!pending) {
      // Вебхук мог уже зачислить платёж — ищем недавно успешный (последние 30 минут)
      const recentDone = await Payment.findOne(
        { userId, status: 'succeeded', updatedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } },
        null,
        { sort: { updatedAt: -1 } },
      ).lean();
      if (recentDone) {
        return res.json({
          ok: true,
          status: 'succeeded',
          alreadyDone: true,
          tokenCredits: recentDone.tokenCredits,
          newBalance: null,
          plan: recentDone.planPurchased,
          planExpiresAt: recentDone.expiresAt || null,
        });
      }
      return res.json({ ok: false, status: 'not_found', message: 'Нет ожидающих платежей' });
    }

    const { data: ykPayment } = await axios.get(
      `${YUKASSA_API}/payments/${pending.externalPaymentId}`,
      { auth: yukassaAuth() },
    );

    logger.info(
      `[payment/check] userId=${userId} paymentId=${pending.externalPaymentId} ykStatus=${ykPayment.status}`,
    );

    // Платеж успешен если status === 'succeeded'
    // При capture: true, это гарантирует что деньги захвачены и списаны
    if (ykPayment.status === 'succeeded') {
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

    // Если статус 'waiting_for_capture' — попытаемся захватить платеж
    // (может быть capture: true не сработал с первого раза)
    if (ykPayment.status === 'waiting_for_capture') {
      logger.info(`[payment/check] Платеж в статусе waiting_for_capture, пытаемся захватить: ${pending.externalPaymentId}`);
      try {
        const { data: capturedPayment } = await axios.post(
          `${YUKASSA_API}/payments/${pending.externalPaymentId}/capture`,
          { amount: { value: ykPayment.amount?.value, currency: 'RUB' } },
          { auth: yukassaAuth() },
        );
        logger.info(`[payment/check] Платеж захвачен: ${pending.externalPaymentId}, новый статус=${capturedPayment.status}`);

        // Если capture успешен, обрабатываем как успешный платеж
        if (capturedPayment.status === 'succeeded') {
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
      } catch (captureErr) {
        logger.error(`[payment/check] Ошибка при захвате платежа: ${pending.externalPaymentId}`, captureErr.response?.data || captureErr.message);
      }
      return res.json({ ok: false, status: 'waiting_for_capture', message: 'Платёж авторизован, но ещё не захвачен. Попытайтесь ещё раз через минуту.' });
    }

    // Для любых других статусов
    return res.json({ ok: false, status: ykPayment.status, message: `Платёж в статусе: ${ykPayment.status}` });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[payment/check]', msg);
    return res.status(500).json({ ok: false, error: `Ошибка проверки: ${msg}` });
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
    if (!payment) return;

    const { userId, tokenCredits, packageId, plan, type } = payment.metadata || {};
    if (!userId || !tokenCredits || !packageId) return;

    logger.info(`[payment/webhook] Получен платеж: id=${payment.id}, status=${payment.status}`);

    // Сохраняем платеж в БД если его еще нет
    await Payment.findOneAndUpdate(
      { externalPaymentId: payment.id },
      {
        $setOnInsert: {
          externalPaymentId: payment.id,
          userId,
          packageId,
          type: type || 'subscription',
          planPurchased: plan || null,
          tokenCredits: parseInt(tokenCredits),
          amount: payment.amount?.value ?? '',
        },
        $set: { status: 'pending' },
      },
      { upsert: true },
    );

    // Обрабатываем платеж если статус 'succeeded'
    if (payment.status === 'succeeded') {
      const result = await applySuccessfulPayment(payment.id);
      if (!result.ok && !result.alreadyDone) {
        logger.warn(`[payment/webhook] apply failed: ${result.message}`);
      }
    } else if (payment.status === 'waiting_for_capture') {
      // Если статус 'waiting_for_capture', попытаемся захватить
      logger.info(`[payment/webhook] Платеж в статусе waiting_for_capture, пытаемся захватить: ${payment.id}`);
      try {
        const { data: capturedPayment } = await axios.post(
          `${YUKASSA_API}/payments/${payment.id}/capture`,
          { amount: { value: payment.amount?.value, currency: 'RUB' } },
          { auth: yukassaAuth() },
        );
        logger.info(`[payment/webhook] Платеж захвачен: ${payment.id}, новый статус=${capturedPayment.status}`);

        // Если capture успешен, обрабатываем платеж
        if (capturedPayment.status === 'succeeded') {
          const result = await applySuccessfulPayment(payment.id);
          if (!result.ok && !result.alreadyDone) {
            logger.warn(`[payment/webhook] apply failed after capture: ${result.message}`);
          }
        }
      } catch (captureErr) {
        logger.error(`[payment/webhook] Ошибка при захвате платежа: ${payment.id}`, captureErr.response?.data || captureErr.message);
      }
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
    const userId = req.user._id; // ObjectId для поиска в БД
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = parseInt(req.query.offset) || 0;
    const payments = await Payment.find({ userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    const total = await Payment.countDocuments({ userId });
    return res.json({ payments, total, limit, offset });
  } catch (err) {
    logger.error('[payment/history]', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
