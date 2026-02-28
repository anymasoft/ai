'use strict';
/**
 * Единственное место, где определяется логика тарифов.
 * Используется в balance controller и admin endpoint.
 *
 * Тарифы: free | pro | business
 * Переход free → pro при накоплении >= 400 000 кредитов на балансе.
 * Переход pro → business при >= 900 000 кредитов.
 */

const TIER_THRESHOLDS = {
  business: 900_000,
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
