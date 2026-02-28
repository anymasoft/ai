'use strict';
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { User, Balance } = require('~/db/models');

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

    const result = users.map((u) => ({
      ...u,
      tokenCredits: balanceMap[u._id.toString()] ?? 0,
    }));

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
 * Начислить баланс пользователю: { credits: number }
 * credits — количество tokenCredits (1000 = $0.001)
 */
router.post('/users/:userId/balance', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const credits = parseInt(req.body.credits);
    if (!credits || credits <= 0 || credits > 100_000_000) {
      return res.status(400).json({ error: 'credits должен быть числом от 1 до 100000000' });
    }

    const balance = await Balance.findOneAndUpdate(
      { user: req.params.userId },
      { $inc: { tokenCredits: credits } },
      { upsert: true, new: true },
    ).lean();

    logger.info(`[admin] ${req.user.email} начислил ${credits} credits пользователю ${req.params.userId}`);
    res.json({ tokenCredits: balance.tokenCredits });
  } catch (err) {
    logger.error('[admin/balance]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
