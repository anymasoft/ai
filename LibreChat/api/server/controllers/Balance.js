const { Balance } = require('~/db/models');
const Subscription = require('~/models/Subscription');

async function balanceController(req, res) {
  const userId = req.user?._id || req.user?.id;

  // ✅ Получаем баланс
  const balanceData = await Balance.findOne(
    { user: userId },
    '-_id tokenCredits autoRefillEnabled refillIntervalValue refillIntervalUnit lastRefill refillAmount',
  ).lean();

  if (!balanceData) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  // If auto-refill is not enabled, remove auto-refill related fields from the response
  if (!balanceData.autoRefillEnabled) {
    delete balanceData.refillIntervalValue;
    delete balanceData.refillIntervalUnit;
    delete balanceData.lastRefill;
    delete balanceData.refillAmount;
  }

  // ⚠️ АРХИТЕКТУРА SSOT: План больше НЕ возвращается отсюда!
  // План берётся из /api/user/subscription, а не из /api/balance!
  res.status(200).json(balanceData);
}

module.exports = balanceController;
