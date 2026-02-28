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
      .select('modelId provider displayName -_id')
      .lean();
    res.json({ models });
  } catch (err) {
    logger.error('[models/all]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/models/allowed
 * Список моделей, разрешённых текущему пользователю по его тарифному плану.
 * Источник: коллекция Plan (allowedModels) + коллекция AiModel (displayName).
 * Кэш на стороне клиента: не более 60 секунд.
 */
router.get('/allowed', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;

    // Определяем план пользователя
    const subscription = await Subscription.findOne({ userId }).lean();
    let plan = subscription?.plan || 'free';
    if (plan !== 'free' && subscription?.planExpiresAt && new Date(subscription.planExpiresAt) < new Date()) {
      plan = 'free';
    }

    await Plan.seedDefaults();
    const planDoc = await Plan.findOne({ planId: plan }, 'allowedModels').lean();
    const allowedModelIds = planDoc?.allowedModels ?? [];

    await AiModel.seedDefaults();
    const query = allowedModelIds.length > 0
      ? { modelId: { $in: allowedModelIds }, isActive: true }
      : { isActive: true };

    const models = await AiModel.find(query)
      .sort({ provider: 1, displayName: 1 })
      .select('modelId provider displayName -_id')
      .lean();

    res.set('Cache-Control', 'private, max-age=60');
    res.json({ models, plan });
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
