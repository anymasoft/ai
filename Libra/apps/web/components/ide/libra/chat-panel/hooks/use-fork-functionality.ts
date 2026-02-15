/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-fork-functionality.ts
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

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTRPC } from '@/trpc/client'
import { useProjectContext } from '@/lib/hooks/use-project-id'
import { useProjectQuota } from '@/components/dashboard/hooks/use-project-quota'
import * as m from '@/paraglide/messages'

export interface UseForkFunctionalityReturn {
  // State
  showForkModal: boolean
  isForkLoading: boolean

  // Quota info
  canFork: boolean
  canCreateProject: boolean
  isQuotaExhausted: boolean
  quotaInfo: any
  isQuotaLoading: boolean

  // Handlers
  handleForkClick: () => void
  handleForkConfirm: () => void
  handleForkCancel: () => void
  getQuotaMessage: () => string
}

/**
 * Custom hook for managing fork functionality
 * Handles fork state, quota checking, and fork operations
 */
export function useForkFunctionality(
  planId?: string,
  isLoading?: boolean
): UseForkFunctionalityReturn {
  const [showForkModal, setShowForkModal] = useState(false)
  const [isForkLoading, setIsForkLoading] = useState(false)

  // Project quota management
  const { canCreateProject, isQuotaExhausted, quotaInfo, isLoading: isQuotaLoading } = useProjectQuota()

  // Fork is available on all AI messages when quota allows and not loading
  // Ensure consistent initial state by checking all required conditions
  const canFork = Boolean(!isLoading && planId && canCreateProject && !isQuotaLoading && !isQuotaExhausted)

  // Fork functionality hooks
  const trpc = useTRPC()
  const { projectId } = useProjectContext()
  const router = useRouter()

  // Generate quota message using internationalization
  const getQuotaMessage = (): string => {
    if (!quotaInfo) return m["dashboard.projectCreateButton.quota.loading"]()

    if (isQuotaExhausted) {
      return m["dashboard.projectCreateButton.quota.exhausted"]({
        used: quotaInfo.projectNumsLimit,
        limit: quotaInfo.projectNumsLimit
      })
    }

    return m["dashboard.projectCreateButton.quota.remaining"]({
      remaining: quotaInfo.projectNums,
      used: quotaInfo.projectNumsLimit - quotaInfo.projectNums,
      limit: quotaInfo.projectNumsLimit
    })
  }

  // Fork mutation
  const forkMutation = useMutation(
    trpc.project.fork.mutationOptions({
      onSuccess: (data) => {
        toast.success('Fork created successfully!')
        setShowForkModal(false)
        setIsForkLoading(false)

        // Redirect to the new forked project
        router.push(`/project/${data.id}`)
      },
      onError: (error: any) => {
        setIsForkLoading(false)

        if (error?.data?.code === 'FORBIDDEN') {
          toast.error('Project quota exceeded. Please upgrade your plan.')
        } else {
          toast.error('Failed to create fork. Please try again.')
        }
      },
    })
  )

  // Fork functionality handlers
  const handleForkClick = () => {
    // Prevent fork action if quota is exceeded
    if (isQuotaExhausted) {
      toast.error('Project quota exceeded. Please upgrade your plan to create more projects.')
      return
    }

    setShowForkModal(true)
  }

  const handleForkConfirm = () => {
    if (!projectId || !planId) {
      toast.error('Unable to fork: missing project or plan information')
      return
    }

    setIsForkLoading(true)
    toast.info('Creating fork...')

    forkMutation.mutate({
      projectId,
      planId,
    })
  }

  const handleForkCancel = () => {
    setShowForkModal(false)
  }

  return {
    showForkModal,
    isForkLoading: Boolean(isForkLoading),
    canFork,
    canCreateProject: Boolean(canCreateProject),
    isQuotaExhausted: Boolean(isQuotaExhausted),
    quotaInfo,
    isQuotaLoading: Boolean(isQuotaLoading),
    handleForkClick,
    handleForkConfirm,
    handleForkCancel,
    getQuotaMessage,
  }
}
