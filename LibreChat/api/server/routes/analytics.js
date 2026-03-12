'use strict';

const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const {
  getOverviewStats,
  getModelUsage,
  getUserUsage,
  getConversationStats,
  getCostBreakdown,
} = require('../services/analyticsService');

const router = express.Router();

/**
 * Проверяет что пользователь ADMIN
 * (используется после requireJwtAuth)
 */
function requireAdminRole(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    logger.warn(`[analytics] Unauthorized admin access attempt by user: ${req.user?.id}`);
    return res.status(403).json({ error: 'Доступ запрещён. Требуется роль ADMIN.' });
  }
  next();
}

/**
 * GET /api/admin/analytics/overview
 * Общая статистика: пользователи, сообщения, токены, беседы
 * Ответ: { totalUsers, activeUsers24h, messages24h, tokens24h, totalMessages, totalTokens, totalConversations }
 */
router.get('/overview', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    logger.debug('[analytics/overview] Request from admin:', req.user?.email);

    const stats = await getOverviewStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/overview] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статистики',
    });
  }
});

/**
 * GET /api/admin/analytics/models
 * Статистика по моделям
 * Ответ: [ { model, requests, uniqueUsers, totalTokens, endpoint }, ... ]
 */
router.get('/models', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    logger.debug('[analytics/models] Request from admin:', req.user?.email);

    const stats = await getModelUsage();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/models] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статистики по моделям',
    });
  }
});

/**
 * GET /api/admin/analytics/users
 * Статистика по пользователям
 * Ответ: [ { userId, email, plan, requests, totalTokens, lastActive, favoriteModel }, ... ]
 */
router.get('/users', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    logger.debug('[analytics/users] Request from admin:', req.user?.email);

    const stats = await getUserUsage();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/users] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статистики по пользователям',
    });
  }
});

/**
 * GET /api/admin/analytics/conversations
 * Статистика по диалогам (limit 100)
 * Ответ: [ { conversationId, user, messageCount, totalTokens, model, lastActive }, ... ]
 */
router.get('/conversations', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    logger.debug('[analytics/conversations] Request from admin:', req.user?.email);

    const stats = await getConversationStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/conversations] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статистики по диалогам',
    });
  }
});

/**
 * GET /api/admin/analytics/costs
 * Статистика расходов токенов
 * Ответ: { tokensToday, tokens7d, tokens30d, costPerModel: [...], costPerUser: [...] }
 */
router.get('/costs', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    logger.debug('[analytics/costs] Request from admin:', req.user?.email);

    const stats = await getCostBreakdown();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/costs] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статистики расходов',
    });
  }
});

module.exports = router;
