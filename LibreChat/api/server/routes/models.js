'use strict';
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { modelController } = require('~/server/controllers/ModelController');
const { requireJwtAuth } = require('~/server/middleware/');
const AiModel = require('~/models/AiModel');
const Plan = require('~/models/Plan');
const Subscription = require('~/models/Subscription');

const router = express.Router();

/**
 * GET /api/models/all
 * Публичный каталог всех активных моделей из коллекции AiModel.
 * Используется страницей /pricing для отображения доступных моделей без аутентификации.
 */
router.get('/all', async (req, res) => {
  try {
    await AiModel.seedDefaults();
    const models = await AiModel.find({ isActive: true })
      .sort({ provider: 1, displayName: 1 })
      .select('modelId provider endpointKey displayName -_id')
      .lean();
    return res.json({ models });
  } catch (err) {
    logger.error('[models/all]', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/models/allowed
 * Список моделей, разрешённых текущему пользователю по его тарифному плану.
 * ПЛЮС текущий план пользователя (для отображения бейджа).
 * Источник: коллекция Plan (allowedModels) + коллекция AiModel + Subscription.
 * Кэш на стороне клиента: не более 60 секунд.
 */
router.get('/allowed', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id; // ObjectId для поиска

    // ✅ Получаем план пользователя
    const subscription = await Subscription.findOne({ userId }).lean();
    let plan = subscription?.plan || 'free';

    // ✅ Проверяем не истёк ли план
    if (plan !== 'free' && subscription?.planExpiresAt && new Date(subscription.planExpiresAt) < new Date()) {
      plan = 'free';
    }

    // ✅ Получаем разрешённые модели для этого плана
    await Plan.seedDefaults();
    const planDoc = await Plan.findOne({ planId: plan }, 'allowedModels').lean();
    const allowedModelIds = planDoc?.allowedModels ?? [];

    // ✅ Получаем модели из каталога
    await AiModel.seedDefaults();
    const query = allowedModelIds.length > 0
      ? { modelId: { $in: allowedModelIds }, isActive: true }
      : { isActive: true };

    const models = await AiModel.find(query)
      .sort({ provider: 1, displayName: 1 })
      .select('modelId provider endpointKey displayName -_id')
      .lean();

    // ✅ Организуем модели по endpointKey для фронтенда
    const modelsByEndpoint = {};
    models.forEach((model) => {
      if (!modelsByEndpoint[model.endpointKey]) {
        modelsByEndpoint[model.endpointKey] = [];
      }
      modelsByEndpoint[model.endpointKey].push(model.modelId);
    });

    res.set('Cache-Control', 'private, max-age=60');
    return res.json({
      ...modelsByEndpoint,
      models, // Плоский массив для фильтрации в компонентах
      plan,   // ✅ ДОБАВЛЯЕМ ПЛАН СЮДА для бейджа!
    });
  } catch (err) {
    logger.error('[models/allowed]', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/models
 * Стандартный LibreChat endpoint — список моделей по эндпоинтам.
 * Используется внутри LibreChat для конфигурации чата.
 */
router.get('/', requireJwtAuth, modelController);

module.exports = router;
