/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * tab-action-buttons.tsx
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

import { cn } from '@libra/ui/lib/utils'
import { GitFork, Loader2 } from 'lucide-react'
import { RollbackIcon } from '@/components/common/Icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@libra/ui/components/tooltip'
import { useState } from 'react'
import { RevertConfirmationModal } from './revert-confirmation-modal'

interface TabActionButtonsProps {
  // Fork props
  canFork: boolean
  canCreateProject: boolean
  planId?: string
  isLoading?: boolean
  isForkLoading: boolean
  isQuotaExhausted: boolean
  isQuotaLoading: boolean
  onForkClick: () => void
  getQuotaMessage: () => string

  // Revert props
  canRevert: boolean
  onRevert?: (planId: string) => Promise<void> | void
}

export const TabActionButtons = ({
  canFork,
  canCreateProject,
  planId,
  isLoading = false,
  isForkLoading,
  isQuotaExhausted,
  isQuotaLoading,
  onForkClick,
  getQuotaMessage,
  canRevert,
  onRevert,
}: TabActionButtonsProps) => {
  // State for revert confirmation modal
  const [showRevertModal, setShowRevertModal] = useState(false)
  const [isRevertLoading, setIsRevertLoading] = useState(false)

  // Handle revert button click - show confirmation modal
  const handleRevertClick = () => {
    setShowRevertModal(true)
  }

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    if (!onRevert || !planId) return

    setIsRevertLoading(true)
    try {
      await onRevert(planId)
      setShowRevertModal(false)
    } catch {
      // Error handling is done in the onRevert function
    } finally {
      setIsRevertLoading(false)
    }
  }

  // Handle revert cancellation
  const handleRevertCancel = () => {
    setShowRevertModal(false)
  }
  return (
    <div className='flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2'>
      {(canFork || (!canCreateProject && planId && !isLoading)) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={onForkClick}
              disabled={Boolean(isForkLoading || isQuotaExhausted || isQuotaLoading)}
              className={cn(
                // Base styling following scroll button pattern with improved touch targets
                'relative flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-all duration-200',
                'ring-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                // Minimum 44px touch target for mobile accessibility
                'min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]',
                // Primary action styling (Fork is more prominent)
                isForkLoading
                  ? 'bg-blue-500/20 text-blue-400 ring-blue-500/30 cursor-not-allowed opacity-75'
                  : isQuotaExhausted || isQuotaLoading
                    ? 'bg-gray-500/10 text-gray-400 ring-gray-500/20 cursor-not-allowed opacity-50'
                    : 'bg-blue-500/10 text-blue-600 ring-blue-500/20 hover:bg-blue-500/20 hover:text-blue-700 hover:ring-blue-500/40 hover:shadow-sm',
                // Interactive states with enhanced feedback
                !isForkLoading && !isQuotaExhausted && !isQuotaLoading && 'transform hover:scale-105 active:scale-95 active:ring-blue-500/50',
                // Dark mode with improved contrast
                'dark:text-blue-400 dark:bg-blue-400/10 dark:ring-blue-400/20',
                !isForkLoading && !isQuotaExhausted && !isQuotaLoading && 'dark:hover:bg-blue-400/20 dark:hover:text-blue-300 dark:hover:ring-blue-400/40 dark:hover:shadow-sm',
                // Disabled state for quota exceeded
                isQuotaExhausted && 'dark:bg-gray-700/10 dark:text-gray-500 dark:ring-gray-700/20',
                // Loading state animation
                isForkLoading && 'animate-pulse'
              )}
              aria-label={
                isQuotaExhausted
                  ? 'Project quota exceeded - upgrade to fork conversations'
                  : 'Fork conversation to new project'
              }
              aria-describedby='fork-tooltip'
            >
              {isForkLoading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <GitFork className='h-4 w-4' />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent
            id='fork-tooltip'
            side='bottom'
            align='center'
            sideOffset={8}
            collisionPadding={16}
            avoidCollisions={true}
            className={cn(
              'quota-tooltip-content',
              'max-w-[280px] sm:max-w-[320px]',
              'text-xs sm:text-sm',
              'z-[100]',
              isQuotaExhausted && 'quota-warning'
            )}
          >
            <div className="flex items-start gap-2">
              {isQuotaExhausted && (
                <span className="text-destructive text-xs mt-0.5 shrink-0" aria-hidden="true">
                  ⚠️
                </span>
              )}
              <span className="flex-1 min-w-0 break-words">
                {isQuotaExhausted
                  ? getQuotaMessage()
                  : 'Fork conversation to new project'
                }
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {canRevert && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={handleRevertClick}
              className={cn(
                // Base styling following scroll button pattern with improved touch targets
                'relative flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-all duration-200',
                'ring-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                // Minimum 44px touch target for mobile accessibility
                'min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]',
                // Secondary action styling with warning semantics (Revert uses amber/orange theme)
                'bg-amber-500/10 text-amber-700 ring-amber-500/20',
                'hover:bg-amber-500/20 hover:text-amber-800 hover:ring-amber-500/40 hover:shadow-sm',
                // Interactive states with enhanced feedback
                'transform hover:scale-105 active:scale-95 active:ring-amber-500/50',
                // Dark mode with improved contrast and amber theme
                'dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20',
                'dark:hover:bg-amber-400/20 dark:hover:text-amber-300 dark:hover:ring-amber-400/40 dark:hover:shadow-sm'
              )}
              aria-label='Revert to this state'
              aria-describedby='revert-tooltip'
            >
              <RollbackIcon className='h-4 w-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent id='revert-tooltip' side='bottom' className='text-sm z-50' sideOffset={8}>
            <p>Revert to this state</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Revert confirmation modal */}
      <RevertConfirmationModal
        open={showRevertModal}
        onClose={handleRevertCancel}
        onConfirm={handleRevertConfirm}
        isLoading={isRevertLoading}
        planId={planId}
      />
    </div>
  )
}
