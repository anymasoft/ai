/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * plan-utils.ts
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

import { PLAN_EMAIL_CONFIG } from '../config/plan-config';
import { PLAN_TYPES, type PlanType, type PlanConfig } from '../types/plan-types';

/**
 * Normalize plan name to match our plan types
 * @param planName - The plan name from user input
 * @returns Normalized plan type
 */
export function normalizePlanName(planName: string): PlanType {
  const normalizedName = planName.toLowerCase().trim();
  
  if (normalizedName.includes('free')) {
    return PLAN_TYPES.FREE;
  }
  
  if (normalizedName.includes('pro')) {
    return PLAN_TYPES.PRO;
  }
  
  if (normalizedName.includes('max')) {
    return PLAN_TYPES.MAX;
  }
  
  // Default to free plan if no match found
  return PLAN_TYPES.FREE;
}

/**
 * Get plan configuration for email templates
 * @param planName - The plan name
 * @returns Plan configuration object
 */
export function getPlanConfig(planName: string): PlanConfig {
  const normalizedPlan = normalizePlanName(planName);
  return PLAN_EMAIL_CONFIG[normalizedPlan];
}

/**
 * Get plan benefits for email display
 * @param planName - The plan name
 * @returns Plan benefits object
 */
export function getPlanBenefits(planName: string) {
  const config = getPlanConfig(planName);
  return config.benefits;
}

/**
 * Get plan pricing information
 * @param planName - The plan name
 * @returns Plan pricing object
 */
export function getPlanPricing(planName: string) {
  const config = getPlanConfig(planName);
  return config.pricing;
}

/**
 * Get plan limits information
 * @param planName - The plan name
 * @returns Plan limits object
 */
export function getPlanLimits(planName: string) {
  const config = getPlanConfig(planName);
  return config.limits;
}

/**
 * Check if plan is free
 * @param planName - The plan name
 * @returns True if plan is free
 */
export function isFreePlan(planName: string): boolean {
  const normalizedPlan = normalizePlanName(planName);
  return normalizedPlan === PLAN_TYPES.FREE;
}

/**
 * Check if plan is pro
 * @param planName - The plan name
 * @returns True if plan is pro
 */
export function isProPlan(planName: string): boolean {
  const normalizedPlan = normalizePlanName(planName);
  return normalizedPlan === PLAN_TYPES.PRO;
}

/**
 * Check if plan is max
 * @param planName - The plan name
 * @returns True if plan is max
 */
export function isMaxPlan(planName: string): boolean {
  const normalizedPlan = normalizePlanName(planName);
  return normalizedPlan === PLAN_TYPES.MAX;
}
