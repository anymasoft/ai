/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * model-selector.tsx
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

import { useEffect, useId } from 'react'
import Image from 'next/image'
import { ChevronDown, Loader2 } from 'lucide-react'

import * as m from '@/paraglide/messages'
import { AI_MODELS } from '@/configs/ai-models'
import { cn } from '@libra/ui/lib/utils'
import { toast } from '@libra/ui/components/sonner'
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@libra/ui/components/tooltip'

import { useModelSelector } from '../hooks/use-model-selector'
import { isQuotaExceeded, type UsageData } from '../utils/quota-utils'
import { ModelItem } from './model-selector/model-item'

interface ModelSelectorProps {
  selectedModelId?: string
  onModelChange?: (modelId: string) => void
  usageData?: UsageData | null
  isUsageLoading?: boolean
}

export const ModelSelector = ({ selectedModelId, onModelChange, usageData, isUsageLoading }: ModelSelectorProps) => {
  const dropdownId = useId()
  const {
    selectedModel,
    isDropdownOpen,
    dropdownPosition,
    dropdownRef,
    buttonRef,
    handleModelSelect,
    toggleDropdown,
    userPlan,
    usageError,
    isUsageError,
  } = useModelSelector({ selectedModelId, onModelChange, usageData, isUsageLoading })

  // Check if quota is exceeded
  const quotaExceeded = isQuotaExceeded(usageData)

  // Handle dropdown toggle with quota check
  const handleDropdownToggle = () => {
    if (quotaExceeded) {
      toast.error(m['chatPanel.modelSelector.quotaExceededChangeModels']())
      return
    }
    toggleDropdown()
  }

  // Show error toast if subscription data fails to load
  useEffect(() => {
    if (isUsageError && usageError) {
      toast.error(m["chatPanel.modelSelector.subscriptionError"](), {
        description: m["chatPanel.modelSelector.subscriptionErrorDesc"](),
        duration: 5000,
        position: 'bottom-right'
      })
    }
  }, [isUsageError, usageError])

  // Show all models, but indicate which ones are restricted
  const allModels = AI_MODELS

  // Handle model selection with feedback
  const handleModelClick = (model: typeof AI_MODELS[0]) => {
    handleModelSelect(model)
    toast.success(m["chatPanel.modelSelector.modelSwitched"]({ name: model.name }), {
      duration: 2000,
      position: 'bottom-right'
    })
  }

  // Handle restricted model click
  const handleRestrictedClick = (model: typeof AI_MODELS[0]) => {
    toast.error(m["chatPanel.modelSelector.modelRestricted"]({ name: model.name }), {
      duration: 3000,
      position: 'bottom-right',
      action: {
        label: m["chatPanel.modelSelector.upgrade"](),
        onClick: () => {
          // TODO: Navigate to upgrade page
        }
      }
    })
  }

  return (
    <TooltipProvider>
      <div className='relative'>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={buttonRef}
              type='button'
              onClick={handleDropdownToggle}
              disabled={isUsageLoading || quotaExceeded}
              onKeyDown={(e) => {
                if (quotaExceeded) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDropdownToggle()
                }
                if (e.key === 'Escape' && isDropdownOpen) {
                  toggleDropdown()
                }
              }}
              className={cn(
                'flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-lg',
                'bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm',
                'border border-gray-200/60 dark:border-neutral-700/60',
                'shadow-sm transition-all duration-200 ease-in-out',
                'focus-visible:outline-none focus-visible:ring-2',
                'group min-w-0',
                // Normal state styles
                !quotaExceeded && !isUsageLoading && [
                  'hover:shadow-md',
                  'dark:text-neutral-200 dark:hover:bg-neutral-700/70 dark:focus-visible:ring-blue-500/50',
                  'text-gray-700 hover:bg-gray-50/80 focus-visible:ring-blue-400/50',
                ],
                // Disabled state styles
                (isUsageLoading || quotaExceeded) && 'opacity-50 cursor-not-allowed',
                // Dropdown open state
                isDropdownOpen && !quotaExceeded && 'ring-2 ring-blue-500/20 border-blue-500/50 shadow-md'
              )}
              aria-label={
                quotaExceeded
                  ? m['chatPanel.modelSelector.quotaExceededChangeModelsShort']()
                  : m["chatPanel.modelSelector.currentModel"]({ name: selectedModel.name })
              }
              aria-expanded={isDropdownOpen}
              aria-controls={dropdownId}
            >
          <div className='flex items-center gap-2 min-w-0 flex-1'>
            {/* Model Icon with Loading State */}
            <div className='relative w-4 h-4 flex-shrink-0'>
              {isUsageLoading ? (
                <Loader2 className='h-4 w-4 animate-spin text-gray-400' />
              ) : (
                <Image
                  src={selectedModel.icon}
                  alt={selectedModel.provider}
                  width={16}
                  height={16}
                  className={cn(
                    'dark:invert transition-transform duration-200',
                    'group-hover:scale-105'
                  )}
                />
              )}
            </div>

            {/* Model Name - Hidden on mobile, shown on larger screens */}
            <span className={cn(
              'hidden sm:inline font-medium truncate transition-colors duration-200',
              isUsageLoading ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'
            )}>
              {selectedModel.name}
            </span>
          </div>

          {/* Chevron Icon */}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 ease-in-out',
              'text-gray-500 dark:text-gray-400',
              'group-hover:text-gray-700 dark:group-hover:text-gray-300',
              isDropdownOpen && 'rotate-180 text-blue-500 dark:text-blue-400'
            )}
          />
        </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {quotaExceeded
                ? m['chatPanel.modelSelector.quotaExceededChangeModels']()
                : m["chatPanel.modelSelector.currentModel"]({ name: selectedModel.name })
              }
            </p>
          </TooltipContent>
        </Tooltip>

      {isDropdownOpen && !quotaExceeded && (
        <div
          id={dropdownId}
          ref={dropdownRef}
          className={cn(
            'fixed w-64 rounded-xl shadow-xl border',
            'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md',
            'border-gray-200/50 dark:border-neutral-700/50',
            'z-[100] overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2',
            'duration-200 ease-out'
          )}
          style={{
            bottom: `${dropdownPosition.bottom}px`,
            left: `${dropdownPosition.left}px`,
            opacity: dropdownPosition.opacity,
          }}
          role='menu'
          aria-label={m["chatPanel.modelSelector.modelMenu"]()}
        >
          <ul className={cn(
            'py-2 max-h-60 overflow-auto',
            'scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600',
            'scrollbar-track-transparent'
          )}>
            {allModels.map((model) => (
              <li key={model.id} className="px-1">
                <ModelItem
                  model={model}
                  isSelected={selectedModel.id === model.id}
                  userPlan={userPlan}
                  onSelect={handleModelClick}
                  onRestrictedClick={handleRestrictedClick}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </TooltipProvider>
  )
}