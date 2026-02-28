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
const { Balance, Payment } = require('~/db/models');

const router = express.Router();

/** Пакеты: id → { amount в рублях, tokenCredits } */
const PACKAGES = {
  pro: { amount: '1990.00', tokenCredits: 900_000 },
  max: { amount: '3990.00', tokenCredits: 2_000_000 },
};

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
 * Общая идемпотентная функция активации успешного платежа.
 * Вызывается и из webhook, и из /check (fallback для localhost).
 *
 * @param {string} externalPaymentId — ID платежа в ЮKassa
 * @returns {{ ok: boolean, message: string }}
 */
async function applySuccessfulPayment(externalPaymentId) {
  // Ищем запись о платеже в нашей БД
  const existing = await Payment.findOne({ externalPaymentId }).lean();

  if (existing && existing.status === 'succeeded') {
    return { ok: true, alreadyDone: true, message: 'Платёж уже был обработан ранее' };
  }

  if (!existing || existing.status !== 'pending') {
    return { ok: false, message: `Платёж не найден в БД или имеет статус ${existing?.status}` };
  }

  const { userId, tokenCredits: creditsRaw, packageId } = existing;
  const creditsNum = parseInt(creditsRaw);
  if (!creditsNum || creditsNum <= 0) {
    return { ok: false, message: `Некорректное значение tokenCredits: ${creditsRaw}` };
  }

  const updatedBalance = await Balance.findOneAndUpdate(
    { user: userId },
    { $inc: { tokenCredits: creditsNum } },
    { upsert: true, new: true },
  );

  await Payment.findOneAndUpdate(
    { externalPaymentId },
    { status: 'succeeded' },
  );

  logger.info(
    `[payment/apply] userId=${userId} packageId=${packageId} +${creditsNum} credits. ` +
    `Новый баланс: ${updatedBalance.tokenCredits}`,
  );

  return { ok: true, alreadyDone: false, tokenCredits: creditsNum, newBalance: updatedBalance.tokenCredits };
}

/**
 * POST /api/payment/create
 * Body: { packageId: 'starter' | 'pro' | 'max' }
 * Создаёт платёж в ЮKassa, сохраняет как 'pending' и возвращает URL для редиректа.
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
        description: `Пополнение баланса — пакет ${packageId}`,
        metadata: { userId, packageId, tokenCredits: pkg.tokenCredits },
      },
      {
        auth,
        headers: { 'Idempotence-Key': idempotenceKey, 'Content-Type': 'application/json' },
      },
    );

    // Сохраняем как 'pending' — чтобы /check мог его найти (fallback для localhost)
    await Payment.findOneAndUpdate(
      { externalPaymentId: data.id },
      {
        externalPaymentId: data.id,
        userId,
        packageId,
        tokenCredits: pkg.tokenCredits,
        amount: pkg.amount,
        status: 'pending',
      },
      { upsert: true },
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
 * GET /api/payment/check
 * Fallback для localhost: frontend вызывает ОДИН РАЗ после редиректа с ?payment=success.
 * В PROD достаточно webhook; /check нужен только когда ЮKassa не может дотянуться до localhost.
 *
 * Алгоритм:
 *  1. Найти последний 'pending' платёж текущего пользователя в нашей БД
 *  2. Запросить его статус в ЮKassa
 *  3. Если 'succeeded' — вызвать applySuccessfulPayment
 */
router.get('/check', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();

    // Ищем последний pending-платёж пользователя
    const pending = await Payment.findOne(
      { userId, status: 'pending' },
      null,
      { sort: { createdAt: -1 } },
    ).lean();

    if (!pending) {
      return res.json({ ok: false, status: 'not_found', message: 'Нет ожидающих платежей' });
    }

    // Проверяем статус в ЮKassa
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
        });
      }
      return res.json({ ok: false, status: 'error', message: result.message });
    }

    if (ykPayment.status === 'canceled') {
      await Payment.findOneAndUpdate(
        { externalPaymentId: pending.externalPaymentId },
        { status: 'failed' },
      );
      return res.json({ ok: false, status: 'canceled', message: 'Платёж отменён' });
    }

    // Всё ещё в процессе (pending / waiting_for_capture)
    return res.json({ ok: false, status: ykPayment.status, message: 'Платёж ещё обрабатывается' });
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    logger.error('[payment/check]', msg);
    res.status(500).json({ ok: false, error: `Ошибка проверки платежа: ${msg}` });
  }
});

/**
 * POST /api/payment/webhook
 * ЮKassa отправляет POST при изменении статуса платежа (только в PROD/staging).
 * Настройте в кабинете ЮKassa: https://ваш-домен.ru/api/payment/webhook
 */
router.post('/webhook', express.json(), async (req, res) => {
  // Отвечаем 200 сразу, чтобы ЮKassa не переотправляла при ошибках на нашей стороне
  res.sendStatus(200);

  try {
    const event = req.body;
    if (!event || event.type !== 'notification') return;

    const payment = event.object;
    if (!payment || payment.status !== 'succeeded') return;

    // Если платёж создавался через /create — запись уже есть в БД (pending)
    // Если нет — создаём её (backward compat / ручные тесты)
    const { userId, tokenCredits, packageId } = payment.metadata || {};
    if (userId && tokenCredits) {
      await Payment.findOneAndUpdate(
        { externalPaymentId: payment.id },
        {
          $setOnInsert: {
            externalPaymentId: payment.id,
            userId,
            packageId,
            tokenCredits: parseInt(tokenCredits),
            amount: payment.amount?.value ?? '',
          },
          $set: { status: 'pending' }, // убедимся что status=pending перед apply
        },
        { upsert: true },
      );
    }

    const result = await applySuccessfulPayment(payment.id);
    if (!result.ok && !result.alreadyDone) {
      logger.warn(`[payment/webhook] applySuccessfulPayment failed: ${result.message}`);
    }
  } catch (err) {
    logger.error('[payment/webhook]', err);
  }
});

/**
 * GET /api/payment/history
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
    logger.error('[payment/history]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
