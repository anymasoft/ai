'use strict';
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { modelController } = require('~/server/controllers/ModelController');
const { requireJwtAuth } = require('~/server/middleware/');
const { AiModel, Plan, Subscription } = require('~/db/models');

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
    res.json({ models });
  } catch (err) {
    logger.error('[models/all]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/models/allowed
 * Список моделей и spec, разрешённых текущему пользователю по его тарифному плану.
 * Организован по endpointKey для фронтенда.
 *
 * Источники:
 * - allowedModels: коллекция Plan + коллекция AiModel (для совместимости)
 * - allowedSpecs: коллекция Plan + librechat.yaml (для spec-driven архитектуры)
 *
 * Кэш на стороне клиента: не более 60 секунд.
 */
router.get('/allowed', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;

    // Определяем план пользователя
    let subscription = await Subscription.findOne({ userId }).lean();

    // Если подписки нет, создаем её с планом 'free'
    if (!subscription) {
      await Subscription.create({
        userId,
        plan: 'free',
        planStartedAt: new Date(),
      });
      subscription = { plan: 'free' };
    }

    let plan = subscription?.plan || 'free';
    if (plan !== 'free' && subscription?.planExpiresAt && new Date(subscription.planExpiresAt) < new Date()) {
      plan = 'free';
    }

    await Plan.seedDefaults();
    const planDoc = await Plan.findOne({ planId: plan }, 'allowedModels allowedSpecs').lean();
    const allowedModelIds = planDoc?.allowedModels ?? [];
    const allowedSpecs = planDoc?.allowedSpecs ?? [];

    // ===== МОДЕЛИ (для совместимости) =====
    await AiModel.seedDefaults();
    const query = allowedModelIds.length > 0
      ? { modelId: { $in: allowedModelIds }, isActive: true }
      : { isActive: true };

    const models = await AiModel.find(query)
      .sort({ provider: 1, displayName: 1 })
      .select('modelId provider endpointKey displayName -_id')
      .lean();

    // Organize models by endpointKey for frontend ModelSelect component
    const modelsByEndpoint = {};
    models.forEach((model) => {
      if (!modelsByEndpoint[model.endpointKey]) {
        modelsByEndpoint[model.endpointKey] = [];
      }
      modelsByEndpoint[model.endpointKey].push(model.modelId);
    });

    // ===== SPEC (для spec-driven архитектуры) =====
    // Фильтруем modelSpecs из конфига по allowedSpecs плана
    const appConfig = req.config;
    const allSpecs = appConfig.modelSpecs?.list ?? [];
    const filteredSpecs = allowedSpecs.length > 0
      ? allSpecs.filter(spec => allowedSpecs.includes(spec.name))
      : allSpecs;

    logger.info(`[models/allowed] [userId: ${userId}] [plan: ${plan}]`);
    res.set('Cache-Control', 'private, max-age=60');
    res.json({
      // Совместимость: модели, организованные по endpoint
      ...modelsByEndpoint,
      models, // Плоский массив моделей

      // Новое: spec для spec-driven архитектуры
      modelSpecs: {
        enforce: appConfig.modelSpecs?.enforce ?? false,
        list: filteredSpecs,
      },

      // Debug информация
      plan,
      allowedSpecs,
      allowedModelIds,
    });
  } catch (err) {
    logger.error('[models/allowed]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/models
 * Стандартный LibreChat endpoint — список моделей по эндпоинтам.
 * Используется внутри LibreChat для конфигурации чата.
 */
router.get('/', requireJwtAuth, modelController);

module.exports = router;
