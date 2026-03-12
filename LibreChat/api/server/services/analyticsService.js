'use strict';

const { logger } = require('@librechat/data-schemas');
const { User, Message, Transaction, Conversation } = require('~/db/models');

/**
 * КРИТИЧНО: Все aggregation pipelines начинаются с $match createdAt
 * Это защищает от full scan в MongoDB через месяцы
 */
const LAST_30_DAYS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

/**
 * GET /api/admin/analytics/overview
 * Возвращает общую статистику: пользователи, сообщения, токены, беседы
 */
async function getOverviewStats() {
  try {
    logger.debug('[analytics] Fetching overview stats');

    const [usersStats, activeUsers24h, messages24h, messagesTotal, tokensData, conversationsTotal] = await Promise.all([
      // Total Users
      User.countDocuments({}),

      // Active Users last 24h
      Message.distinct('user', {
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      }).then((users) => users.length),

      // Messages last 24h
      Message.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      }),

      // Messages total
      Message.countDocuments({}),

      // Tokens last 24h и total
      Transaction.aggregate([
        {
          $facet: {
            last24h: [
              {
                $match: {
                  createdAt: {
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$tokenValue' },
                },
              },
            ],
            total: [
              {
                $group: {
                  _id: null,
                  total: { $sum: '$tokenValue' },
                },
              },
            ],
          },
        },
      ]),

      // Total Conversations
      Conversation.countDocuments({}),
    ]);

    const tokens24h = tokensData[0].last24h[0]?.total || 0;
    const tokensTotal = tokensData[0].total[0]?.total || 0;

    return {
      totalUsers: usersStats,
      activeUsers24h,
      messages24h,
      totalMessages: messagesTotal,
      tokens24h,
      totalTokens: tokensTotal,
      totalConversations: conversationsTotal,
    };
  } catch (err) {
    logger.error('[analytics/overview]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/models
 * Статистика по моделям: какие модели используют пользователи
 */
async function getModelUsage() {
  try {
    logger.debug('[analytics] Fetching model usage');

    // ✅ SAFE: $match createdAt в начале
    const stats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: LAST_30_DAYS },
        },
      },
      {
        $group: {
          _id: '$model',
          requests: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
          totalTokens: { $sum: '$tokenValue' },
          endpoint: { $first: '$endpoint' },
        },
      },
      {
        $project: {
          model: '$_id',
          requests: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalTokens: 1,
          endpoint: 1,
          _id: 0,
        },
      },
      {
        $sort: { requests: -1 },
      },
      {
        $limit: 100,
      },
    ]);

    return stats;
  } catch (err) {
    logger.error('[analytics/models]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/users
 * Статистика по пользователям: запросы, токены, последняя активность
 */
async function getUserUsage() {
  try {
    logger.debug('[analytics] Fetching user usage');

    // ✅ SAFE: Используем Transaction (индексировано лучше чем Message)
    const stats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: LAST_30_DAYS },
        },
      },
      {
        $group: {
          _id: '$user',
          requests: { $sum: 1 },
          totalTokens: { $sum: '$tokenValue' },
          models: { $addToSet: '$model' },
          lastActive: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData',
        },
      },
      {
        $unwind: {
          path: '$userData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'subscriptions',
          localField: '_id',
          foreignField: 'userId',
          as: 'subscriptionData',
        },
      },
      {
        $unwind: {
          path: '$subscriptionData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          userId: '$_id',
          email: '$userData.email',
          plan: { $ifNull: ['$subscriptionData.plan', 'free'] },
          requests: 1,
          totalTokens: 1,
          lastActive: 1,
          favoriteModel: { $arrayElemAt: ['$models', 0] },
          _id: 0,
        },
      },
      {
        $sort: { requests: -1 },
      },
      {
        $limit: 100,
      },
    ]);

    return stats;
  } catch (err) {
    logger.error('[analytics/users]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/conversations
 * Статистика по диалогам: сообщения, токены, модели
 */
async function getConversationStats() {
  try {
    logger.debug('[analytics] Fetching conversation stats');

    // ✅ SAFE: $match createdAt + $sort + $limit 100
    const stats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: LAST_30_DAYS },
        },
      },
      {
        $group: {
          _id: '$conversationId',
          totalTokens: { $sum: '$tokenValue' },
          messageCount: { $sum: 1 },
          models: { $addToSet: '$model' },
          user: { $first: '$user' },
          lastActive: { $max: '$createdAt' },
        },
      },
      {
        $sort: { lastActive: -1 },
      },
      {
        $limit: 100,
      },
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'conversationId',
          as: 'conversationData',
        },
      },
      {
        $project: {
          conversationId: '$_id',
          user: 1,
          messageCount: 1,
          totalTokens: 1,
          model: { $arrayElemAt: ['$models', 0] },
          lastActive: 1,
          _id: 0,
        },
      },
    ]);

    return stats;
  } catch (err) {
    logger.error('[analytics/conversations]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/costs
 * Статистика стоимости: токены по дням и моделям
 */
async function getCostBreakdown() {
  try {
    logger.debug('[analytics] Fetching cost breakdown');

    // ✅ SAFE: $match createdAt в начале
    const stats = await Transaction.aggregate([
      {
        $facet: {
          today: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$tokenValue' },
              },
            },
          ],
          last7d: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$tokenValue' },
              },
            },
          ],
          last30d: [
            {
              $match: {
                createdAt: { $gte: LAST_30_DAYS },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$tokenValue' },
              },
            },
          ],
          byModel: [
            {
              $match: {
                createdAt: { $gte: LAST_30_DAYS },
              },
            },
            {
              $group: {
                _id: '$model',
                totalTokens: { $sum: '$tokenValue' },
                requests: { $sum: 1 },
              },
            },
            {
              $project: {
                model: '$_id',
                totalTokens: 1,
                requests: 1,
                _id: 0,
              },
            },
            {
              $sort: { totalTokens: -1 },
            },
            {
              $limit: 50,
            },
          ],
          byUser: [
            {
              $match: {
                createdAt: { $gte: LAST_30_DAYS },
              },
            },
            {
              $group: {
                _id: '$user',
                totalTokens: { $sum: '$tokenValue' },
              },
            },
            {
              $sort: { totalTokens: -1 },
            },
            {
              $limit: 50,
            },
          ],
        },
      },
    ]);

    return {
      tokensToday: stats[0].today[0]?.total || 0,
      tokens7d: stats[0].last7d[0]?.total || 0,
      tokens30d: stats[0].last30d[0]?.total || 0,
      costPerModel: stats[0].byModel || [],
      costPerUser: stats[0].byUser || [],
    };
  } catch (err) {
    logger.error('[analytics/costs]', err);
    throw err;
  }
}

module.exports = {
  getOverviewStats,
  getModelUsage,
  getUserUsage,
  getConversationStats,
  getCostBreakdown,
};
