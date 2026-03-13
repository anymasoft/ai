'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware/');
const { Message, Conversation } = require('~/db/models');
const {
  getOverviewStats,
  getModelUsage,
  getUserUsage,
  getConversationStats,
  getCostBreakdown,
} = require('../services/analyticsService');

const router = express.Router();

/**
 * ⚠️ CRITICAL MIDDLEWARE: Skip SSE/EventStream requests
 * MCP connections configured under /api/admin/* paths need to pass through without interference
 * SSE streaming requires raw HTTP connection - any JSON parsing or other middleware breaks it
 *
 * This middleware returns early if the request looks like an SSE/streaming request,
 * allowing it to pass to the next route handler or ultimately 404 (which is correct behavior)
 * for requests that don't match any analytics endpoint.
 */
router.use((req, res, next) => {
  const accept = req.headers.accept || '';
  const isEventStream = accept.toLowerCase().includes('text/event-stream');

  if (isEventStream) {
    logger.debug(
      '[analytics] Skipping analytics middleware for SSE request:',
      { method: req.method, path: req.path, accept }
    );
    // Skip analytics - let Express continue to next route or 404
    return next('route');
  }

  next();
});

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
 * Query параметры:
 *   - range: '24h'|'7d'|'30d'|'all' (default: '30d') [для согласованности API]
 * ✅ ПРИМЕЧАНИЕ: overview ВСЕГДА возвращает activeUsers24h и totalUsers, независимо от range
 * Ответ: { totalUsers, activeUsers24h, messages24h, tokens24h, totalMessages, totalTokens, totalConversations }
 */
router.get('/overview', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    logger.debug('[analytics/overview] Request from admin:', {
      email: req.user?.email,
      range,
    });

    const stats = await getOverviewStats(range);

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
 * Query параметры:
 *   - range: '24h'|'7d'|'30d'|'all' (default: '30d')
 * Ответ: [ { model, requests, uniqueUsers, totalTokens, endpoint }, ... ]
 */
router.get('/models', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    logger.debug('[analytics/models] Request from admin:', {
      email: req.user?.email,
      range,
    });

    const stats = await getModelUsage(range);

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
 * Query параметры:
 *   - range: '24h'|'7d'|'30d'|'all' (default: '30d')
 * Ответ: [ { userId, email, plan, requests, totalTokens, lastActive, favoriteModel }, ... ]
 */
router.get('/users', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    logger.debug('[analytics/users] Request from admin:', {
      email: req.user?.email,
      range,
    });

    const stats = await getUserUsage(range);

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
 * Query параметры:
 *   - range: '24h'|'7d'|'30d'|'all' (default: '30d')
 * Ответ: [ { conversationId, user, messageCount, totalTokens, model, lastActive }, ... ]
 */
router.get('/conversations', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    logger.debug('[analytics/conversations] Request from admin:', {
      email: req.user?.email,
      range,
    });

    const stats = await getConversationStats(range);

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

/**
 * GET /api/admin/conversation-preview/:conversationId
 * Получить последние 50 сообщений диалога для modal preview
 * ⚠️ КРИТИЧНО: conversationId это STRING, а не ObjectId!
 * Сообщения хранятся в коллекции Message с полем conversationId (string)
 */
router.get('/conversation-preview/:conversationId', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { conversationId } = req.params;

    logger.debug('[analytics/conversation-preview] Request from admin:', req.user?.email, 'conversationId:', conversationId);

    // ✅ ПРАВИЛЬНО: Ищем сообщения напрямую в коллекции Message по conversationId (string)
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(50)
      .select('sender text createdAt')
      .lean();

    // Преобразуем в нужный формат для фронтенда
    const preview = messages.map((msg) => ({
      role: msg.sender === 'assistant' ? 'assistant' : 'user',
      text: msg.text || '',
      createdAt: msg.createdAt,
    }));

    res.json({
      success: true,
      data: preview,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/conversation-preview] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении preview диалога',
    });
  }
});

/**
 * POST /api/admin/conversation-reply
 * Отправить ответ от администратора в диалог пользователя
 * ⚠️ КРИТИЧНО: Защищено requireJwtAuth + requireAdminRole
 */
router.post('/conversation-reply', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'conversationId и message обязательны',
      });
    }

    logger.debug('[analytics/conversation-reply] Admin reply from:', req.user?.email, 'conversationId:', conversationId);

    // ✅ SAFE: Добавляем сообщение администратора в диалог
    const result = await Conversation.updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $push: {
          messages: {
            role: 'assistant',
            content: message.trim(),
            createdAt: new Date(),
          },
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Диалог не найден',
      });
    }

    logger.info('[analytics/conversation-reply] Message added by admin:', req.user?.email, 'to conversation:', conversationId);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[analytics/conversation-reply] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отправке ответа',
    });
  }
});

module.exports = router;
