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

  // ✅ Получаем информацию о плане (подписке)
  const subscription = await Subscription.findOne({ userId }).lean();
  let plan = subscription?.plan || 'free';
  let planExpiresAt = subscription?.planExpiresAt || null;

  // ✅ Проверяем не истёк ли план
  if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
    plan = 'free';
    planExpiresAt = null;
  }

  // If auto-refill is not enabled, remove auto-refill related fields from the response
  if (!balanceData.autoRefillEnabled) {
    delete balanceData.refillIntervalValue;
    delete balanceData.refillIntervalUnit;
    delete balanceData.lastRefill;
    delete balanceData.refillAmount;
  }

  // ✅ Добавляем информацию о плане в response
  res.status(200).json({
    ...balanceData,
    plan,           // 'free' | 'pro' | 'business'
    planExpiresAt,  // ISO date string или null
  });
}

module.exports = balanceController;
