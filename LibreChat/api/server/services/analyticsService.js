'use strict';

const { logger } = require('@librechat/data-schemas');
const { User, Message, Transaction, Conversation } = require('~/db/models');

/**
 * КРИТИЧНО: Все aggregation pipelines начинаются с $match createdAt
 * Это защищает от full scan в MongoDB через месяцы
 */
const LAST_30_DAYS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

/**
 * Исключённые из аналитики пользователи (тестовые аккаунты)
 * Можно задать через env: ANALYTICS_EXCLUDED_USERS=user1@example.com,user2@example.com
 */
const EXCLUDED_USERS = process.env.ANALYTICS_EXCLUDED_USERS
  ? process.env.ANALYTICS_EXCLUDED_USERS.split(',').map(e => e.trim())
  : [];

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Получить фильтр дата для aggregation pipeline
 * Поддерживает динамическую фильтрацию временного диапазона
 *
 * @param {string} range - Временной диапазон: '24h', '7d', '30d', или 'all'
 * @returns {Date|null} - Дата для $gte фильтра, или null для 'all'
 */
function getDateFilter(range = '30d') {
  const now = Date.now();

  switch (range) {
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null; // Без фильтра
    default:
      logger.warn(`[analytics] Unknown range: ${range}, using default 30d`);
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * GET /api/admin/analytics/overview
 * Возвращает общую статистику: пользователи, сообщения, токены, беседы
 * КРИТИЧНО: исключённые пользователи должны быть исключены из расчётов
 */
async function getOverviewStats(range = '30d') {
  try {
    logger.debug('[analytics] Fetching overview stats', { range });
    // ✅ ПРИМЕЧАНИЕ: overview ВСЕГДА возвращает activeUsers24h, totalUsers (независимо от range)
    // range параметр добавлен для согласованности API, но влияет только на запросы которые его поддерживают

    const [usersStats, activeUsers24h, messages24h, messagesTotal, tokensData, conversationsTotal] = await Promise.all([
      // Total Users (только активные, не исключённые)
      EXCLUDED_USERS.length > 0
        ? User.aggregate([
            {
              $match: {
                email: { $nin: EXCLUDED_USERS },
              },
            },
            {
              $count: 'total',
            },
          ]).then((res) => res[0]?.total || 0)
        : User.countDocuments({}),

      // Active Users last 24h (исключённые не считаются)
      EXCLUDED_USERS.length > 0
        ? Message.aggregate([
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            {
              $match: {
                'userData.email': { $nin: EXCLUDED_USERS },
              },
            },
            {
              $group: {
                _id: '$user',
              },
            },
            {
              $count: 'total',
            },
          ]).then((res) => res[0]?.total || 0)
        : Message.distinct('user', {
            createdAt: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          }).then((users) => users.length),

      // Messages last 24h (исключённые не считаются)
      EXCLUDED_USERS.length > 0
        ? Message.aggregate([
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            {
              $match: {
                'userData.email': { $nin: EXCLUDED_USERS },
              },
            },
            {
              $count: 'total',
            },
          ]).then((res) => res[0]?.total || 0)
        : Message.countDocuments({
            createdAt: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          }),

      // Messages total (исключённые не считаются)
      EXCLUDED_USERS.length > 0
        ? Message.aggregate([
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            {
              $match: {
                'userData.email': { $nin: EXCLUDED_USERS },
              },
            },
            {
              $count: 'total',
            },
          ]).then((res) => res[0]?.total || 0)
        : Message.countDocuments({}),

      // Tokens last 24h и total (исключённые не считаются)
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
                $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'userData',
                },
              },
              {
                $unwind: '$userData',
              },
              ...(EXCLUDED_USERS.length > 0
                ? [
                    {
                      $match: {
                        'userData.email': { $nin: EXCLUDED_USERS },
                      },
                    },
                  ]
                : []),
              {
                $group: {
                  _id: null,
                  total: { $sum: '$tokenValue' },
                },
              },
            ],
            total: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'userData',
                },
              },
              {
                $unwind: '$userData',
              },
              ...(EXCLUDED_USERS.length > 0
                ? [
                    {
                      $match: {
                        'userData.email': { $nin: EXCLUDED_USERS },
                      },
                    },
                  ]
                : []),
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

      // Total Conversations (исключённые не считаются)
      EXCLUDED_USERS.length > 0
        ? Conversation.aggregate([
            {
              $lookup: {
                from: 'transactions',
                localField: '_id',
                foreignField: 'conversationId',
                as: 'transactions',
              },
            },
            {
              $unwind: '$transactions',
            },
            {
              $lookup: {
                from: 'users',
                localField: 'transactions.user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            {
              $match: {
                'userData.email': { $nin: EXCLUDED_USERS },
              },
            },
            {
              $group: {
                _id: '$_id',
              },
            },
            {
              $count: 'total',
            },
          ]).then((res) => res[0]?.total || 0)
        : Conversation.countDocuments({}),
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
 * ⚠️ ПРАВИЛЬНЫЙ ПОРЯДОК: $match → $lookup → $unwind → $match excluded → $group
 */
async function getModelUsage(range = '30d') {
  try {
    logger.debug('[analytics] Fetching model usage', { range });

    const filterDate = getDateFilter(range);

    // ✅ SAFE: $match createdAt в начале, исключение ДО $group
    const pipeline = [];

    if (filterDate) {
      pipeline.push({
        $match: {
          createdAt: { $gte: filterDate },
        },
      });
    }

    // Lookup пользователей
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo',
      },
    });

    // Unwind - удалит документы без пользователя (INNER JOIN)
    pipeline.push({
      $unwind: '$userInfo',
    });

    // Исключаем тестовых пользователей ДО группировки
    if (EXCLUDED_USERS.length > 0) {
      pipeline.push({
        $match: {
          'userInfo.email': { $nin: EXCLUDED_USERS },
        },
      });
    }

    // Только ПОСЛЕ фильтрации делаем группировку
    pipeline.push({
      $group: {
        _id: '$model',
        requests: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
        totalTokens: { $sum: '$tokenValue' },
        endpoint: { $first: '$endpoint' },
      },
    });

    pipeline.push({
      $project: {
        model: '$_id',
        requests: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        totalTokens: 1,
        endpoint: 1,
        _id: 0,
      },
    });

    pipeline.push({
      $sort: { requests: -1 },
    });

    pipeline.push({
      $limit: 100,
    });

    const stats = await Transaction.aggregate(pipeline);
    return stats;
  } catch (err) {
    logger.error('[analytics/models]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/users
 * Статистика по пользователям: запросы, токены, последняя активность
 * ⚠️ КРИТИЧНО: исключение ДОЛЖНО быть ДО $group, не после!
 */
async function getUserUsage(range = '30d') {
  try {
    logger.debug('[analytics] Fetching user usage', { range });

    const filterDate = getDateFilter(range);

    // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК: $match → $lookup → $unwind → $match excluded → $group
    const pipeline = [];

    if (filterDate) {
      pipeline.push({
        $match: {
          createdAt: { $gte: filterDate },
        },
      });
    }

    // Lookup пользователей
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userData',
      },
    });

    // Unwind - удалит документы без пользователя (INNER JOIN)
    pipeline.push({
      $unwind: '$userData',
    });

    // Исключаем тестовых пользователей ДО группировки
    if (EXCLUDED_USERS.length > 0) {
      pipeline.push({
        $match: {
          'userData.email': { $nin: EXCLUDED_USERS },
        },
      });
    }

    // Только ПОСЛЕ фильтрации делаем группировку по пользователю
    pipeline.push({
      $group: {
        _id: '$user',
        userId: { $first: '$user' },
        email: { $first: '$userData.email' },
        requests: { $sum: 1 },
        totalTokens: { $sum: '$tokenValue' },
        models: { $addToSet: '$model' },
        lastActive: { $max: '$createdAt' },
      },
    });

    // Lookup подписки
    pipeline.push({
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'userId',
        as: 'subscriptionData',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$subscriptionData',
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push({
      $project: {
        userId: 1,
        email: 1,
        plan: { $ifNull: ['$subscriptionData.plan', 'free'] },
        requests: 1,
        totalTokens: 1,
        lastActive: 1,
        favoriteModel: { $arrayElemAt: ['$models', 0] },
        _id: 0,
      },
    });

    pipeline.push({
      $sort: { requests: -1 },
    });

    pipeline.push({
      $limit: 100,
    });

    const stats = await Transaction.aggregate(pipeline);
    return stats;
  } catch (err) {
    logger.error('[analytics/users]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/conversations
 * Статистика по диалогам: сообщения, токены, модели
 * ⚠️ ОСОБЕННОСТЬ: группируем по conversationId, но фильтруем по пользователю ПЕРЕД группировкой
 */
async function getConversationStats(range = '30d') {
  try {
    logger.debug('[analytics] Fetching conversation stats', { range });

    // ✅ НОВОЕ: Получить фильтр дата в зависимости от range
    const filterDate = getDateFilter(range);

    // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК: $match → $lookup → $unwind → $match excluded → $group
    // ✅ Первый $match применяется только если filterDate не null
    const pipeline = [];

    // STAGE 1: Условно применяем фильтр по дате
    if (filterDate) {
      pipeline.push({
        $match: {
          createdAt: { $gte: filterDate },
        },
      });
    }

    // STAGE 2-8: Остальной pipeline (как было)
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userData',
      },
    });

    pipeline.push({
      $unwind: '$userData',
    });

    // Исключаем тестовых пользователей ДО группировки
    if (EXCLUDED_USERS.length > 0) {
      pipeline.push({
        $match: {
          'userData.email': { $nin: EXCLUDED_USERS },
        },
      });
    }

    // Группируем только по допустимым пользователям
    pipeline.push({
      $group: {
        _id: '$conversationId',
        totalTokens: { $sum: '$tokenValue' },
        messageCount: { $sum: 1 },
        models: { $addToSet: '$model' },
        userEmail: { $first: '$userData.email' },
        lastActive: { $max: '$createdAt' },
      },
    });

    pipeline.push({
      $sort: { lastActive: -1 },
    });

    pipeline.push({
      $limit: 100,
    });

    pipeline.push({
      $project: {
        conversationId: '$_id',
        user: '$userEmail',
        messageCount: 1,
        totalTokens: 1,
        model: { $arrayElemAt: ['$models', 0] },
        lastActive: 1,
        _id: 0,
      },
    });

    const stats = await Transaction.aggregate(pipeline);
    return stats;
  } catch (err) {
    logger.error('[analytics/conversations]', err);
    throw err;
  }
}

/**
 * GET /api/admin/analytics/costs
 * Статистика стоимости: токены по дням и моделям
 * ⚠️ КРИТИЧНО: исключённые пользователи исключаются ДО группировки, не после
 */
async function getCostBreakdown() {
  try {
    logger.debug('[analytics] Fetching cost breakdown');

    // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК: $match → $lookup → $unwind → $match excluded → $group
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
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            ...(EXCLUDED_USERS.length > 0
              ? [
                  {
                    $match: {
                      'userData.email': { $nin: EXCLUDED_USERS },
                    },
                  },
                ]
              : []),
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
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            ...(EXCLUDED_USERS.length > 0
              ? [
                  {
                    $match: {
                      'userData.email': { $nin: EXCLUDED_USERS },
                    },
                  },
                ]
              : []),
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
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            ...(EXCLUDED_USERS.length > 0
              ? [
                  {
                    $match: {
                      'userData.email': { $nin: EXCLUDED_USERS },
                    },
                  },
                ]
              : []),
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
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            ...(EXCLUDED_USERS.length > 0
              ? [
                  {
                    $match: {
                      'userData.email': { $nin: EXCLUDED_USERS },
                    },
                  },
                ]
              : []),
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
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
              },
            },
            {
              $unwind: '$userData',
            },
            ...(EXCLUDED_USERS.length > 0
              ? [
                  {
                    $match: {
                      'userData.email': { $nin: EXCLUDED_USERS },
                    },
                  },
                ]
              : []),
            {
              $group: {
                _id: '$userData.email',
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
