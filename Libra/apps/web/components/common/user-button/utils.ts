/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * utils.ts
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

import { TIER_INFO, type TierType } from './constants'

export interface ExtendedUserData {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  image?: string | null;
}

export interface UsageInfo {
  tierType: TierType;
  currentUsage: number;
  totalLimit: number;
  usagePercentage: number;
  remainingUsage: number;
  planDetails: any;
  hasMultiplePlans: boolean;
}

// Generate user initials
export const getUserInitials = (name: string) => {
  return name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((letter) => letter?.[0]?.toUpperCase())
        .join('')
    : '?'
}

// Generate email initial, use username initial as fallback if email is invalid
export const getEmailInitial = (email?: string | null, fallbackName?: string | null): string => {
  // Try to get initial from email - add more robust checks
  if (email && typeof email === 'string' && email.trim().length > 0) {
    const firstChar = email.trim()[0]
    if (firstChar && /[a-zA-Z]/.test(firstChar)) {
      return firstChar.toUpperCase()
    }
  }

  // If email is invalid, use username initial as fallback
  if (fallbackName && typeof fallbackName === 'string' && fallbackName.trim().length > 0) {
    return getUserInitials(fallbackName)
  }

  // Final fallback
  return '?'
}

// Process usage data
export const getUsageInfo = (usageData: any, isUsageLoading: boolean): UsageInfo => {
  if (isUsageLoading || !usageData) {
    return {
      tierType: 'FREE',
      currentUsage: 0,
      totalLimit: 10,
      usagePercentage: 0,
      remainingUsage: 0,
      planDetails: null,
      hasMultiplePlans: false
    }
  }

  const { planDetails, aiNums, aiNumsLimit } = usageData
  const hasPaid = !!(planDetails && planDetails.paid)
  const hasFree = !!(planDetails && planDetails.free)
  
  // Determine tier type
  let tierType: TierType = 'FREE'
  if (hasPaid && planDetails && planDetails.paid) {
    const paidPlan = planDetails.paid.plan.toLowerCase()
    if (paidPlan.includes('max')) {
      tierType = 'MAX'
    } else if (paidPlan.includes('pro')) {
      tierType = 'PRO'
    }
  }

  // Fix logic: aiNums is remaining count, need to calculate used count
  let remainingUsage = aiNums
  let totalLimit = aiNumsLimit
  let currentUsage = Math.max(0, totalLimit - remainingUsage)
  
  // If has paid plan, calculate paid and free usage separately
  if (hasPaid && hasFree && planDetails.paid && planDetails.free) {
    const paidRemaining = planDetails.paid.aiNums
    const freeRemaining = planDetails.free.aiNums
    const paidLimit = planDetails.paid.aiNumsLimit
    const freeLimit = planDetails.free.aiNumsLimit
    
    remainingUsage = paidRemaining + freeRemaining
    totalLimit = paidLimit + freeLimit
    currentUsage = Math.max(0, totalLimit - remainingUsage)
  }

  const usagePercentage = totalLimit > 0 ? Math.floor((currentUsage * 100) / totalLimit) : 0

  return {
    tierType,
    currentUsage,
    totalLimit,
    usagePercentage,
    remainingUsage,
    planDetails,
    hasMultiplePlans: hasPaid && hasFree
  }
}