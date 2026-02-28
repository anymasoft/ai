'use strict';
/**
 * Единственное место, где определяется логика тарифов.
 * Используется в balance controller и admin endpoint.
 *
 * Тарифы: free | pro | business
 *
 * Пороги выровнены по пакетам оплаты:
 *   Pro-пакет     = 900 000 кредитов  → тариф Pro     (400 000..1 999 999)
 *   Business-пакет= 2 000 000 кредитов → тариф Business (>= 2 000 000)
 *
 * Порог Pro (400 000) ниже пакета, чтобы пользователь оставался в тарифе Pro
 * даже потратив половину купленных кредитов.
 */

const TIER_THRESHOLDS = {
  business: 2_000_000,
  pro: 400_000,
};

/**
 * @param {number} tokenCredits
 * @returns {'free' | 'pro' | 'business'}
 */
function computeTier(tokenCredits) {
  if (tokenCredits >= TIER_THRESHOLDS.business) return 'business';
  if (tokenCredits >= TIER_THRESHOLDS.pro) return 'pro';
  return 'free';
}

module.exports = { computeTier, TIER_THRESHOLDS };
