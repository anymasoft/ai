const { Balance } = require('~/db/models');
const { SystemRoles } = require('librechat-data-provider');
const Subscription = require('~/models/Subscription');

async function balanceController(req, res) {
  const userId = req.user?._id || req.user?.id;
  const userRole = req.user?.role;

  // ✅ Получаем баланс
  const balanceData = await Balance.findOne(
    { user: userId },
    '-_id tokenCredits autoRefillEnabled refillIntervalValue refillIntervalUnit lastRefill refillAmount',
  ).lean();

  if (!balanceData) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  // Role-based access control:
  // - ADMIN: see all fields including autoRefillEnabled and refill settings
  // - USER: see only tokenCredits (read-only)
  if (userRole !== SystemRoles.ADMIN) {
    // For regular users, only show token credits (read-only)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(200).json({
      tokenCredits: balanceData.tokenCredits,
    });
  }

  // For admins, include all auto-refill information
  // If auto-refill is not enabled, remove auto-refill related fields from the response
  if (!balanceData.autoRefillEnabled) {
    delete balanceData.refillIntervalValue;
    delete balanceData.refillIntervalUnit;
    delete balanceData.lastRefill;
    delete balanceData.refillAmount;
  }

  // ⚠️ АРХИТЕКТУРА SSOT: План больше НЕ возвращается отсюда!
  // План берётся из /api/user/subscription, а не из /api/balance!
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.status(200).json(balanceData);
}

module.exports = balanceController;
