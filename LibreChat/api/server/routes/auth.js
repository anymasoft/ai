const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  resetPasswordRequestController,
  resetPasswordController,
  registrationController,
  graphTokenController,
  refreshController,
} = require('~/server/controllers/AuthController');
const {
  regenerateBackupCodes,
  disable2FA,
  confirm2FA,
  enable2FA,
  verify2FA,
} = require('~/server/controllers/TwoFactorController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const middleware = require('~/server/middleware');
const { Subscription, Plan } = require('~/db/models');

const router = express.Router();

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', middleware.requireJwtAuth, logoutController);
router.post(
  '/login',
  middleware.logHeaders,
  middleware.loginLimiter,
  middleware.checkBan,
  ldapAuth ? middleware.requireLdapAuth : middleware.requireLocalAuth,
  // ПРИМЕЧАНИЕ: setBalanceConfig больше НЕ НУЖЕН здесь
  // ensureBalance middleware применяется глобально в server/index.js
  // и гарантирует инициализацию Balance для всех authenticated запросов
  loginController,
);
router.post('/refresh', refreshController);
router.post(
  '/register',
  middleware.registerLimiter,
  middleware.checkBan,
  middleware.checkInviteUser,
  middleware.validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  middleware.resetPasswordLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordRequestController,
);
router.post(
  '/resetPassword',
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordController,
);

router.get('/2fa/enable', middleware.requireJwtAuth, enable2FA);
router.post('/2fa/verify', middleware.requireJwtAuth, verify2FA);
router.post('/2fa/verify-temp', middleware.checkBan, verify2FAWithTempToken);
router.post('/2fa/confirm', middleware.requireJwtAuth, confirm2FA);
router.post('/2fa/disable', middleware.requireJwtAuth, disable2FA);
router.post('/2fa/backup/regenerate', middleware.requireJwtAuth, regenerateBackupCodes);

router.get('/graph-token', middleware.requireJwtAuth, graphTokenController);

/**
 * GET /api/auth/plan
 * Возвращает текущий план пользователя и его allowedModels
 */
router.get('/plan', middleware.requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id; // ObjectId для поиска
    const userIdString = userId?.toString(); // Строка для логирования

    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }

    let subscription = await Subscription.findOne({ userId }).lean();

    // Если подписки нет, создаем её с планом 'free'
    if (!subscription) {
      try {
        await Subscription.create({
          userId,
          plan: 'free',
        });
        subscription = { plan: 'free' };
        logger.info(`[auth/plan] Created subscription for userId: ${userIdString}`);
      } catch (subErr) {
        logger.error(`[auth/plan] Failed to create subscription for userId: ${userIdString}`, subErr);
        subscription = { plan: 'free' };
      }
    }

    let plan = subscription?.plan || 'free';
    let planExpiresAt = subscription?.planExpiresAt || null;

    // Проверяем истёк ли план
    if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
      plan = 'free';
      planExpiresAt = null;
    }

    // Получаем информацию о плане из коллекции Plan
    await Plan.seedDefaults();
    const planConfig = await Plan.findOne({ planId: plan }).lean();

    logger.info(`[auth/plan] [userId: ${userIdString}] [plan: ${plan}]`);
    res.json({
      plan,
      planExpiresAt,
      allowedModels: planConfig?.allowedModels || [],
    });
  } catch (err) {
    logger.error('[auth/plan]', err);
    res.status(500).json({ error: 'Failed to get user plan' });
  }
});

module.exports = router;
