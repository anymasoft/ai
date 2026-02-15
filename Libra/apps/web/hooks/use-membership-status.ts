/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-membership-status.ts
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

import { useTRPC } from '@/trpc/client'
import { authClient } from '@libra/auth/auth-client'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

/**
 * Membership status interface (matches backend)
 */
export interface MembershipStatus {
  isPremium: boolean
  plan: string
  features: {
    canUseCustomDomains: boolean
    canCreateUnlimitedProjects: boolean
    canUseAdvancedAI: boolean
    canInviteMembers: boolean
    canAccessAnalytics: boolean
    canExportProjects: boolean
    canCreatePrivateProjects: boolean
  }
  usage: {
    aiNums: number
    aiNumsLimit: number
    projectNums: number
    projectNumsLimit: number
    seats: number
    seatsLimit: number
  }
  periodEnd?: string
}

/**
 * Hook return type
 */
export interface UseMembershipStatusReturn {
  // Membership data
  membershipStatus: MembershipStatus | null
  
  // Loading states
  isLoading: boolean
  isError: boolean
  error: Error | null
  
  // Convenience flags
  isPremium: boolean
  isFreePlan: boolean
  
  // Feature access shortcuts
  canUseCustomDomains: boolean
  canCreateUnlimitedProjects: boolean
  canUseAdvancedAI: boolean
  canInviteMembers: boolean
  canAccessAnalytics: boolean
  canExportProjects: boolean
  canCreatePrivateProjects: boolean
  
  // Usage information
  aiUsagePercentage: number
  projectUsagePercentage: number
  seatsUsagePercentage: number
  
  // Actions
  handleUpgrade: () => void
  refetch: () => void
}

/**
 * Unified membership status hook
 * Provides comprehensive membership information and feature access
 */
export function useMembershipStatus(): UseMembershipStatusReturn {
  const trpc = useTRPC()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: activeOrganization } = authClient.useActiveOrganization()

  // Query membership status
  const membershipQuery = useQuery(
    trpc.customDomain.getMembershipStatus.queryOptions(
      {},
      {
        enabled: !!session && !!activeOrganization?.id,
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: true,
        refetchInterval: 60 * 1000, // 1 minute
      }
    )
  )

  const membershipStatus = membershipQuery.data ?? null
  const isLoading = membershipQuery.isLoading
  const isError = membershipQuery.isError

  // Convert TRPC error to standard Error
  let error: Error | null = null
  if (membershipQuery.error) {
    error = new Error(membershipQuery.error.message)
    error.name = 'MembershipError'
  }

  // Convenience flags
  const isPremium = membershipStatus?.isPremium ?? false
  const isFreePlan = membershipStatus?.plan === 'FREE' || !isPremium

  // Feature access shortcuts
  const canUseCustomDomains = membershipStatus?.features.canUseCustomDomains ?? false
  const canCreateUnlimitedProjects = membershipStatus?.features.canCreateUnlimitedProjects ?? false
  const canUseAdvancedAI = membershipStatus?.features.canUseAdvancedAI ?? false
  const canInviteMembers = membershipStatus?.features.canInviteMembers ?? false
  const canAccessAnalytics = membershipStatus?.features.canAccessAnalytics ?? false
  const canExportProjects = membershipStatus?.features.canExportProjects ?? false
  const canCreatePrivateProjects = membershipStatus?.features.canCreatePrivateProjects ?? false

  // Usage calculations
  const aiUsagePercentage = membershipStatus 
    ? Math.round(((membershipStatus.usage.aiNumsLimit - membershipStatus.usage.aiNums) / membershipStatus.usage.aiNumsLimit) * 100)
    : 0

  const projectUsagePercentage = membershipStatus
    ? Math.round(((membershipStatus.usage.projectNumsLimit - membershipStatus.usage.projectNums) / membershipStatus.usage.projectNumsLimit) * 100)
    : 0

  const seatsUsagePercentage = membershipStatus
    ? Math.round((membershipStatus.usage.seats / membershipStatus.usage.seatsLimit) * 100)
    : 0

  // Handle upgrade action
  const handleUpgrade = () => {
    router.push('/#price')
  }

  return {
    // Membership data
    membershipStatus,
    
    // Loading states
    isLoading,
    isError,
    error,
    
    // Convenience flags
    isPremium,
    isFreePlan,
    
    // Feature access shortcuts
    canUseCustomDomains,
    canCreateUnlimitedProjects,
    canUseAdvancedAI,
    canInviteMembers,
    canAccessAnalytics,
    canExportProjects,
    canCreatePrivateProjects,
    
    // Usage information
    aiUsagePercentage,
    projectUsagePercentage,
    seatsUsagePercentage,
    
    // Actions
    handleUpgrade,
    refetch: membershipQuery.refetch,
  }
}
