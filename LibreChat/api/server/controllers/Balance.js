const { Balance, Subscription } = require('~/db/models');

async function balanceController(req, res) {
  const userId = req.user.id;

  const [balanceData, subscription] = await Promise.all([
    Balance.findOne(
      { user: userId },
      '-_id tokenCredits autoRefillEnabled refillIntervalValue refillIntervalUnit lastRefill refillAmount',
    ).lean(),
    Subscription.findOne({ userId }).lean(),
  ]);

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

  // Lazy expiry: если план истёк — понижаем до free прямо здесь
  let plan = subscription?.plan || 'free';
  let planStartedAt = subscription?.planStartedAt || null;
  let planExpiresAt = subscription?.planExpiresAt || null;

  if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
    await Subscription.findOneAndUpdate({ userId }, { plan: 'free', planExpiresAt: null, planStartedAt: null });
    plan = 'free';
    planStartedAt = null;
    planExpiresAt = null;
  }

  res.status(200).json({ ...balanceData, plan, planStartedAt, planExpiresAt });
}

module.exports = balanceController;
