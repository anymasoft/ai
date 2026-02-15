/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-project-quota.ts
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
import { useProjectCreationAccess } from '@/hooks/use-feature-access'
import { useMembershipStatus } from '@/hooks/use-membership-status'

/**
 * Project quota information interface
 */
export interface ProjectQuotaInfo {
  projectNums: number
  projectNumsLimit: number
  plan: string
  periodEnd?: string
}

/**
 * Hook return type
 */
export interface UseProjectQuotaReturn {
  // Quota information
  quotaInfo: ProjectQuotaInfo | null

  // Status flags
  canCreateProject: boolean
  isQuotaExhausted: boolean
  isLoading: boolean
  isError: boolean

  // Error information
  error: Error | null

  // Helper functions
  getQuotaPercentage: () => number
}

/**
 * New unified project quota hook using membership architecture
 * Recommended for new code
 */
export function useUnifiedProjectQuota() {
  return useProjectCreationAccess()
}

/**
 * Legacy project quota hook for backward compatibility
 * @deprecated Use useUnifiedProjectQuota or useProjectCreationAccess instead
 */
export function useProjectQuota(): UseProjectQuotaReturn {
  const trpc = useTRPC()

  // Get current active organization
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const organizationId = activeOrganization?.id

  // Query project quota status
  const quotaQuery = useQuery({
    ...trpc.project.getQuotaStatus.queryOptions({}),
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })

  // Fix type error: ensure undefined is converted to null
  const quotaInfo = quotaQuery.data ?? null
  const isError = quotaQuery.isError

  // Fix type error: convert TRPC error object to standard Error object
  let error: Error | null = null
  if (quotaQuery.error) {
    error = new Error()
    error.message = quotaQuery.error.message
    error.name = 'TRPCError'
  }

  // Calculate loading state - consider both query loading and organization loading
  // When organizationId is undefined, we're still loading the organization data
  const isLoading = quotaQuery.isLoading || !organizationId

  // Calculate status flags with consistent initial states
  // When loading or no quota info, default to restrictive state to prevent hydration mismatch
  const canCreateProject = Boolean(quotaInfo && quotaInfo.projectNums > 0)
  const isQuotaExhausted = Boolean(quotaInfo && quotaInfo.projectNums <= 0)

  // Helper function to get quota percentage
  const getQuotaPercentage = (): number => {
    if (!quotaInfo || quotaInfo.projectNumsLimit === 0) return 0

    const usedCount = quotaInfo.projectNumsLimit - quotaInfo.projectNums
    return Math.min(Math.round((usedCount / quotaInfo.projectNumsLimit) * 100), 100)
  }

  return {
    quotaInfo,
    canCreateProject,
    isQuotaExhausted,
    isLoading,
    isError,
    error,
    getQuotaPercentage,
  }
}
