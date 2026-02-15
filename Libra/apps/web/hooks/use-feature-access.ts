/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-feature-access.ts
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

'use client'

import { useMembershipStatus } from './use-membership-status'

/**
 * Feature names that can be checked
 */
export type FeatureName = 
  | 'customDomains'
  | 'unlimitedProjects'
  | 'advancedAI'
  | 'memberInvites'
  | 'analytics'
  | 'projectExport'

/**
 * Feature access result
 */
export interface FeatureAccessResult {
  hasAccess: boolean
  isLoading: boolean
  requiresUpgrade: boolean
  upgradeMessage: string
  handleUpgrade: () => void
}

/**
 * Feature access hook
 * Provides granular feature access checking with upgrade prompts
 */
export function useFeatureAccess(feature: FeatureName): FeatureAccessResult {
  const {
    canUseCustomDomains,
    canCreateUnlimitedProjects,
    canUseAdvancedAI,
    canInviteMembers,
    canAccessAnalytics,
    canExportProjects,
    isLoading,
    isPremium,
    handleUpgrade,
  } = useMembershipStatus()

  // Map feature names to access flags
  const featureAccessMap = {
    customDomains: canUseCustomDomains,
    unlimitedProjects: canCreateUnlimitedProjects,
    advancedAI: canUseAdvancedAI,
    memberInvites: canInviteMembers,
    analytics: canAccessAnalytics,
    projectExport: canExportProjects,
  }

  // Map feature names to upgrade messages
  const upgradeMessageMap = {
    customDomains: 'Custom domains are available for Pro and Max plans. Upgrade to connect your own domain.',
    unlimitedProjects: 'Unlimited projects are available with the Max plan. Upgrade to create unlimited projects.',
    advancedAI: 'Advanced AI features are available for Pro and Max plans. Upgrade to access enhanced AI capabilities.',
    memberInvites: 'Team member invitations are available for Pro and Max plans. Upgrade to collaborate with your team.',
    analytics: 'Analytics and insights are available for Pro and Max plans. Upgrade to track your project performance.',
    projectExport: 'Project export is available for Pro and Max plans. Upgrade to export and backup your projects.',
  }

  const hasAccess = featureAccessMap[feature] ?? false
  const requiresUpgrade = !hasAccess && !isPremium
  const upgradeMessage = upgradeMessageMap[feature] ?? 'This feature requires a premium plan.'

  return {
    hasAccess,
    isLoading,
    requiresUpgrade,
    upgradeMessage,
    handleUpgrade,
  }
}

/**
 * Multiple feature access hook
 * Check access to multiple features at once
 */
export function useMultipleFeatureAccess(features: FeatureName[]) {
  const {
    canUseCustomDomains,
    canCreateUnlimitedProjects,
    canUseAdvancedAI,
    canInviteMembers,
    canAccessAnalytics,
    canExportProjects,
    isLoading,
    isPremium,
    handleUpgrade,
  } = useMembershipStatus()

  // Map feature names to access flags
  const featureAccessMap = {
    customDomains: canUseCustomDomains,
    unlimitedProjects: canCreateUnlimitedProjects,
    advancedAI: canUseAdvancedAI,
    memberInvites: canInviteMembers,
    analytics: canAccessAnalytics,
    projectExport: canExportProjects,
  }

  // Map feature names to upgrade messages
  const upgradeMessageMap = {
    customDomains: 'Custom domains are available for Pro and Max plans. Upgrade to connect your own domain.',
    unlimitedProjects: 'Unlimited projects are available with the Max plan. Upgrade to create unlimited projects.',
    advancedAI: 'Advanced AI features are available for Pro and Max plans. Upgrade to access enhanced AI capabilities.',
    memberInvites: 'Team member invitations are available for Pro and Max plans. Upgrade to collaborate with your team.',
    analytics: 'Analytics and insights are available for Pro and Max plans. Upgrade to track your project performance.',
    projectExport: 'Project export is available for Pro and Max plans. Upgrade to export and backup your projects.',
  }

  const results = features.map(feature => {
    const hasAccess = featureAccessMap[feature] ?? false
    const requiresUpgrade = !hasAccess && !isPremium
    const upgradeMessage = upgradeMessageMap[feature] ?? 'This feature requires a premium plan.'

    return {
      feature,
      hasAccess,
      isLoading,
      requiresUpgrade,
      upgradeMessage,
      handleUpgrade,
    }
  })

  const hasAllAccess = results.every(result => result.hasAccess)
  const hasAnyAccess = results.some(result => result.hasAccess)

  return {
    results,
    hasAllAccess,
    hasAnyAccess,
    isLoading,
    handleUpgrade,
  }
}

/**
 * Project creation access hook
 * Specialized hook for project creation with quota checking
 */
export function useProjectCreationAccess() {
  const {
    membershipStatus,
    canCreateUnlimitedProjects,
    isLoading,
    handleUpgrade,
  } = useMembershipStatus()

  const canCreateProject = membershipStatus
    ? canCreateUnlimitedProjects || membershipStatus.usage.projectNums > 0
    : false

  const isQuotaExhausted = membershipStatus
    ? !canCreateUnlimitedProjects && membershipStatus.usage.projectNums <= 0
    : false

  const quotaMessage = membershipStatus
    ? isQuotaExhausted
      ? `Project quota exhausted (${membershipStatus.usage.projectNumsLimit}/${membershipStatus.usage.projectNumsLimit} used). Upgrade to create more projects.`
      : `${membershipStatus.usage.projectNums} projects remaining (${membershipStatus.usage.projectNumsLimit - membershipStatus.usage.projectNums}/${membershipStatus.usage.projectNumsLimit} used)`
    : 'Loading project quota...'

  return {
    canCreateProject,
    isQuotaExhausted,
    quotaMessage,
    isLoading,
    handleUpgrade,
    quotaInfo: membershipStatus?.usage,
  }
}

/**
 * AI usage access hook
 * Specialized hook for AI feature usage with quota checking
 */
export function useAIUsageAccess() {
  const {
    membershipStatus,
    canUseAdvancedAI,
    isLoading,
    handleUpgrade,
  } = useMembershipStatus()

  const canUseAI = membershipStatus
    ? membershipStatus.usage.aiNums > 0
    : false

  const isQuotaExhausted = membershipStatus
    ? membershipStatus.usage.aiNums <= 0
    : false

  const quotaMessage = membershipStatus
    ? isQuotaExhausted
      ? `AI quota exhausted (${membershipStatus.usage.aiNumsLimit}/${membershipStatus.usage.aiNumsLimit} used). Upgrade or wait for next billing cycle.`
      : `${membershipStatus.usage.aiNums} AI messages remaining (${membershipStatus.usage.aiNumsLimit - membershipStatus.usage.aiNums}/${membershipStatus.usage.aiNumsLimit} used)`
    : 'Loading AI quota...'

  return {
    canUseAI,
    canUseAdvancedAI,
    isQuotaExhausted,
    quotaMessage,
    isLoading,
    handleUpgrade,
    quotaInfo: membershipStatus?.usage,
  }
}
