/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * subscription-limits.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

 // Modular exports after refactoring
 // The original file has been split into multiple modules to improve maintainability and reduce code size

// Export types and constants
export { PLAN_TYPES } from './subscription-limits/types'
export type { PlanType, PlanLimits, SubscriptionLimitRecord, PlanDetails, SubscriptionUsage } from './subscription-limits/types'

// Export utility functions
export {
  fetchPlanLimitsWithCache,
  getLatestActiveLimit,
  createPlanDetails,
  clearPlanLimitCache
} from './subscription-limits/utils'

// Export core business functions
export {
  createOrUpdateSubscriptionLimit,
  cancelSubscriptionLimits,
  checkAndUpdateAIMessageUsage,
  checkAndUpdateEnhanceUsage,
  checkAndUpdateProjectUsage,
  checkAndUpdateDeployUsage,
  getCombinedProjectQuota,
  getSubscriptionUsage,
  restoreProjectQuotaOnDeletion
} from './subscription-limits/core'