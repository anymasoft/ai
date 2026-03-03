'use strict';
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/SubscriptionController');
const { requireJwtAuth } = require('../middleware/');

/**
 * GET /api/user/subscription
 * Получить информацию о подписке текущего пользователя
 *
 * Response:
 * {
 *   planId: 'pro',
 *   planName: 'Pro',
 *   expiresAt: '2026-04-03T00:00:00Z',
 *   allowedModels: ['gpt-4o', 'claude-3-opus', ...],
 *   allowedSpecs: [...],
 *   tokenCreditsOnPurchase: 900000,
 *   durationDays: 30,
 *   isActive: true,
 *   features: { webSearch: true, codeInterpreter: true, prioritySupport: false }
 * }
 */
router.get('/', requireJwtAuth, subscriptionController);

module.exports = router;
