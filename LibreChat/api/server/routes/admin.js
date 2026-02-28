'use strict';
const express = require('express');
const axios = require('axios');
const { computeTier } = require('../utils/computeTier');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { User, Balance, Payment } = require('~/db/models');

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
    const balances = await Balance.find({ user: { $in: userIds } }, 'user tokenCredits').lean();
    const balanceMap = Object.fromEntries(balances.map((b) => [b.user.toString(), b.tokenCredits]));

    const result = users.map((u) => {
      const tokenCredits = balanceMap[u._id.toString()] ?? 0;
      return { ...u, tokenCredits, tier: computeTier(tokenCredits) };
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

module.exports = router;
