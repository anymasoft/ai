/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * membership-validation.ts
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

import { getSubscriptionUsage } from '@libra/auth/utils/subscription-limits'
import { PLAN_TYPES } from '@libra/auth/utils/subscription-limits/types'
import { log } from '@libra/common'
import { TRPCError } from '@trpc/server'

/**
 * Check if user has premium membership (non-free plan)
 * @param organizationId - Organization ID to check membership for
 * @returns Promise<boolean> - true if user has premium membership
 */
export async function hasPremiumMembership(organizationId: string): Promise<boolean> {
  try {
    const usage = await getSubscriptionUsage(organizationId)

    // Check if the plan is not the free plan
    const isPremium = usage.plan !== PLAN_TYPES.FREE

    log.subscription('info', 'Membership check completed', {
      organizationId,
      plan: usage.plan,
      isPremium,
      operation: 'hasPremiumMembership',
    })

    return isPremium
  } catch (error) {
    log.subscription(
      'error',
      'Failed to check membership status',
      {
        organizationId,
        operation: 'hasPremiumMembership',
      },
      error instanceof Error ? error : new Error(String(error))
    )

    // Default to false (no premium access) on error
    return false
  }
}

/**
 * Require premium membership for a feature, throw error if not premium
 * @param organizationId - Organization ID to check membership for
 * @param featureName - Name of the feature requiring premium membership
 * @throws TRPCError if user doesn't have premium membership
 */
export async function requirePremiumMembership(
  organizationId: string,
  featureName = 'this feature'
): Promise<void> {
  const isPremium = await hasPremiumMembership(organizationId)

  if (!isPremium) {
    log.subscription('warn', 'Premium feature access denied', {
      organizationId,
      featureName,
      operation: 'requirePremiumMembership',
    })

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Premium membership required to use ${featureName}. Please upgrade your plan to access this feature.`,
    })
  }
}

/**
 * Feature access permissions interface
 */
export interface FeaturePermissions {
  canUseCustomDomains: boolean
  canCreateUnlimitedProjects: boolean
  canUseAdvancedAI: boolean
  canInviteMembers: boolean
  canAccessAnalytics: boolean
  canExportProjects: boolean
  canCreatePrivateProjects: boolean
}

/**
 * Extended membership status with detailed feature permissions
 */
export interface MembershipStatus {
  isPremium: boolean
  plan: string
  features: FeaturePermissions
  usage: {
    aiNums: number
    aiNumsLimit: number
    projectNums: number
    projectNumsLimit: number
    seats: number
    seatsLimit: number
  }
  periodEnd?: string | undefined
}

/**
 * Get feature permissions based on plan type
 */
function getFeaturePermissions(plan: string): FeaturePermissions {
  const isPremium = plan !== PLAN_TYPES.FREE

  return {
    canUseCustomDomains: isPremium,
    canCreateUnlimitedProjects: plan === PLAN_TYPES.MAX,
    canUseAdvancedAI: isPremium,
    canInviteMembers: isPremium,
    canAccessAnalytics: isPremium,
    canExportProjects: isPremium,
    canCreatePrivateProjects: isPremium,
  }
}

/**
 * Get comprehensive membership status with feature permissions
 * @param organizationId - Organization ID to get membership details for
 * @returns Promise<MembershipStatus> - Detailed membership information
 */
export async function getMembershipStatus(organizationId: string): Promise<MembershipStatus> {
  try {
    const usage = await getSubscriptionUsage(organizationId)
    const isPremium = usage.plan !== PLAN_TYPES.FREE
    const features = getFeaturePermissions(usage.plan)

    return {
      isPremium,
      plan: usage.plan,
      features,
      usage: {
        aiNums: usage.aiNums,
        aiNumsLimit: usage.aiNumsLimit,
        projectNums: usage.projectNums,
        projectNumsLimit: usage.projectNumsLimit,
        seats: usage.seats,
        seatsLimit: usage.seatsLimit,
      },
      periodEnd: usage.planDetails?.paid?.periodEnd,
    }
  } catch (error) {
    log.subscription(
      'error',
      'Failed to get membership status',
      {
        organizationId,
        operation: 'getMembershipStatus',
      },
      error instanceof Error ? error : new Error(String(error))
    )

    // Default to free plan on error
    return {
      isPremium: false,
      plan: PLAN_TYPES.FREE,
      features: getFeaturePermissions(PLAN_TYPES.FREE),
      usage: {
        aiNums: 0,
        aiNumsLimit: 50,
        projectNums: 0,
        projectNumsLimit: 3,
        seats: 1,
        seatsLimit: 1,
      },
    }
  }
}

/**
 * Feature-specific validation functions
 */

/**
 * Require custom domain access
 */
export async function requireCustomDomainAccess(organizationId: string): Promise<void> {
  await requirePremiumMembership(organizationId, 'custom domains')
}

/**
 * Require advanced AI features
 */
export async function requireAdvancedAI(organizationId: string): Promise<void> {
  await requirePremiumMembership(organizationId, 'advanced AI features')
}

/**
 * Require member invitation permissions
 */
export async function requireMemberInviteAccess(organizationId: string): Promise<void> {
  await requirePremiumMembership(organizationId, 'member invitations')
}

/**
 * Require analytics access
 */
export async function requireAnalyticsAccess(organizationId: string): Promise<void> {
  await requirePremiumMembership(organizationId, 'analytics')
}

/**
 * Require project export permissions
 */
export async function requireProjectExportAccess(organizationId: string): Promise<void> {
  await requirePremiumMembership(organizationId, 'project export')
}

/**
 * Require private project access
 */
export async function requirePrivateProjectAccess(organizationId: string): Promise<void> {
  await requirePremiumMembership(organizationId, 'private projects')
}

/**
 * Check if user can create more projects
 */
export async function canCreateProject(organizationId: string): Promise<boolean> {
  try {
    const usage = await getSubscriptionUsage(organizationId)

    // MAX plan has unlimited projects
    if (usage.plan === PLAN_TYPES.MAX) {
      return true
    }

    // Check if user has remaining project quota
    return usage.projectNums > 0
  } catch (error) {
    log.subscription(
      'error',
      'Failed to check project creation permission',
      {
        organizationId,
        operation: 'canCreateProject',
      },
      error instanceof Error ? error : new Error(String(error))
    )

    return false
  }
}

/**
 * Unified feature access checker
 */
export async function hasFeatureAccess(
  organizationId: string,
  feature: keyof FeaturePermissions
): Promise<boolean> {
  try {
    const membershipStatus = await getMembershipStatus(organizationId)
    return membershipStatus.features[feature]
  } catch (error) {
    log.subscription(
      'error',
      'Failed to check feature access',
      {
        organizationId,
        feature,
        operation: 'hasFeatureAccess',
      },
      error instanceof Error ? error : new Error(String(error))
    )

    return false
  }
}

/**
 * Require specific feature access
 */
export async function requireFeatureAccess(
  organizationId: string,
  feature: keyof FeaturePermissions,
  featureName?: string
): Promise<void> {
  const hasAccess = await hasFeatureAccess(organizationId, feature)

  if (!hasAccess) {
    const displayName = featureName || feature.replace(/([A-Z])/g, ' $1').toLowerCase()

    log.subscription('warn', 'Feature access denied', {
      organizationId,
      feature,
      operation: 'requireFeatureAccess',
    })

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Premium membership required to use ${displayName}. Please upgrade your plan to access this feature.`,
    })
  }
}
