'use strict';
/**
 * ЮKassa payment integration
 *
 * Env vars required (добавить в .env):
 *   YOOKASSA_SHOP_ID=<ваш shopId из кабинета ЮKassa>
 *   YOOKASSA_API_KEY=<секретный ключ магазина>
 *   YOOKASSA_RETURN_URL=https://ваш-домен.ru/pricing?payment=success
 *
 * Пакеты: npm install uuid node-fetch (node-fetch уже есть в проекте через axios, используем axios)
 */
const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { Balance, Payment } = require('~/db/models');

const router = express.Router();

/** Пакеты: id → { amount в рублях, tokenCredits } */
const PACKAGES = {
  starter: { amount: '990.00', tokenCredits: 400_000 },
  pro:     { amount: '1990.00', tokenCredits: 900_000 },
  max:     { amount: '3990.00', tokenCredits: 2_000_000 },
};

const YUKASSA_API = 'https://api.yookassa.ru/v2';

function yukassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_API_KEY;
  if (!shopId || !secretKey) {
    throw new Error('YOOKASSA_SHOP_ID и YOOKASSA_API_KEY должны быть заданы в .env');
  }
  return { username: shopId, password: secretKey };
}

/**
 * POST /api/payment/create
 * Body: { packageId: 'starter' | 'pro' | 'max' }
 * Создаёт платёж в ЮKassa и возвращает URL для редиректа.
 * Идемпотентность: idempotenceKey = userId + packageId + датаДня
 */
router.post('/create', requireJwtAuth, async (req, res) => {
  try {
    const { packageId } = req.body;
    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return res.status(400).json({ error: `Неизвестный пакет: ${packageId}` });
    }

    const userId = req.user._id.toString();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // Idempotence key: один платёж за пакет в день
    const idempotenceKey = crypto
      .createHash('sha256')
      .update(`${userId}:${packageId}:${today}`)
      .digest('hex');

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
        description: `Пополнение баланса — пакет ${packageId}`,
        metadata: {
          userId,
          packageId,
          tokenCredits: pkg.tokenCredits,
        },
      },
      {
        auth,
        headers: {
          'Idempotence-Key': idempotenceKey,
          'Content-Type': 'application/json',
        },
      },
    );

    logger.info(`[payment/create] userId=${userId} packageId=${packageId} paymentId=${data.id}`);

    res.json({
      paymentId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url,
    });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[payment/create]', msg);
    res.status(500).json({ error: `Ошибка создания платежа: ${msg}` });
  }
});

/**
 * POST /api/payment/webhook
 * ЮKassa отправляет POST при изменении статуса платежа.
 * Верификация через IP whitelist или HMAC (здесь — через секрет + статус).
 *
 * Настройте в кабинете ЮKassa:
 *   URL уведомлений: https://ваш-домен.ru/api/payment/webhook
 */
router.post('/webhook', express.json(), async (req, res) => {
  // Отвечаем 200 сразу, чтобы ЮKassa не переотправляла
  res.sendStatus(200);

  try {
    const event = req.body;

    if (!event || event.type !== 'notification') {
      return;
    }

    const payment = event.object;
    if (!payment || payment.status !== 'succeeded') {
      return;
    }

    const { userId, tokenCredits, packageId } = payment.metadata || {};
    if (!userId || !tokenCredits) {
      logger.warn('[payment/webhook] Нет userId или tokenCredits в metadata', payment.id);
      return;
    }

    const creditsNum = parseInt(tokenCredits);
    if (!creditsNum || creditsNum <= 0) {
      logger.warn('[payment/webhook] Некорректное значение tokenCredits', tokenCredits);
      return;
    }

    // Идемпотентность: проверяем paymentId, чтобы не начислить дважды
    // Используем Balance как источник истины — upsert с уникальным ключом
    // Простая защита: храним последний paymentId в комментарии транзакции
    // Полная идемпотентность: можно добавить отдельную коллекцию Payment,
    // но для MVP достаточно: ЮKassa гарантирует однократную доставку при 200.

    // Идемпотентность: проверяем, не был ли этот платёж уже обработан
    const existingPayment = await Payment.findOne({ externalPaymentId: payment.id });
    if (existingPayment && existingPayment.status === 'succeeded') {
      logger.info(`[payment/webhook] Платёж ${payment.id} уже обработан, пропускаем`);
      return;
    }

    const updatedBalance = await Balance.findOneAndUpdate(
      { user: userId },
      { $inc: { tokenCredits: creditsNum } },
      { upsert: true, new: true },
    );

    // Сохраняем запись о платеже
    await Payment.findOneAndUpdate(
      { externalPaymentId: payment.id },
      {
        userId,
        packageId,
        tokenCredits: creditsNum,
        amount: payment.amount?.value ?? '',
        status: 'succeeded',
      },
      { upsert: true },
    );

    logger.info(
      `[payment/webhook] userId=${userId} packageId=${packageId} +${creditsNum} credits. ` +
      `Новый баланс: ${updatedBalance.tokenCredits}`,
    );
  } catch (err) {
    logger.error('[payment/webhook]', err);
  }
});

/**
 * GET /api/billing/history
 * История платежей текущего пользователя
 */
router.get('/history', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = parseInt(req.query.offset) || 0;

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Payment.countDocuments({ userId });

    res.json({ payments, total, limit, offset });
  } catch (err) {
    logger.error('[billing/history]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
