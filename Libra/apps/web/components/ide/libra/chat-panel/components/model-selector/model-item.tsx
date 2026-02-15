/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * model-item.tsx
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

import { Check, Lock } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@libra/ui/lib/utils'
import { canAccessModel, type AIModel } from '@/configs/ai-models'
import { PlanBadge } from './plan-badge'
import { UpgradeTooltip } from './upgrade-tooltip'

interface ModelItemProps {
  model: AIModel
  isSelected: boolean
  userPlan: string
  onSelect: (model: AIModel) => void
  onRestrictedClick: (model: AIModel) => void
}

export const ModelItem = ({ 
  model, 
  isSelected, 
  userPlan, 
  onSelect, 
  onRestrictedClick 
}: ModelItemProps) => {
  const canAccess = canAccessModel(userPlan, model.id)

  const handleClick = () => {
    if (canAccess) {
      onSelect(model)
    } else {
      onRestrictedClick(model)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const content = (
    <button
      type='button'
      role='menuitem'
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      disabled={!canAccess}
      className={cn(
        'flex items-center justify-between w-full px-3 py-2.5 text-sm text-left',
        'transition-all duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-blue-50/50',
        'dark:focus:bg-blue-900/10 dark:focus:ring-blue-400/20',
        isSelected && canAccess
          ? 'bg-blue-50 dark:bg-blue-900/20 font-medium text-blue-900 dark:text-blue-100'
          : canAccess
            ? 'hover:bg-gray-50 dark:hover:bg-neutral-700/50 text-gray-900 dark:text-gray-200'
            : 'opacity-60 cursor-not-allowed text-gray-500 dark:text-gray-400',
        'group relative'
      )}
      aria-selected={isSelected}
      aria-disabled={!canAccess}
    >
      <div className='flex items-center gap-3 flex-1 min-w-0'>
        {/* Model Icon */}
        <div className={cn(
          'relative w-5 h-5 flex-shrink-0 transition-transform duration-200',
          'group-hover:scale-105'
        )}>
          <Image
            src={model.icon}
            alt={model.provider}
            width={20}
            height={20}
            className={cn(
              'dark:invert transition-opacity duration-200',
              !canAccess && 'opacity-50'
            )}
          />
        </div>

        {/* Model Name */}
        <span className={cn(
          'font-medium truncate transition-colors duration-200',
          canAccess ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
        )}>
          {model.name}
        </span>

        {/* Lock Icon for Restricted Models */}
        {!canAccess && (
          <Lock className={cn(
            'h-3.5 w-3.5 flex-shrink-0 ml-1',
            'text-gray-400 dark:text-gray-500',
            'transition-colors duration-200'
          )} />
        )}
      </div>

      {/* Right Side: Badge and Check */}
      <div className='flex items-center gap-2 flex-shrink-0'>
        {/* Plan Badge */}
        <PlanBadge requiredPlan={model.requiredPlan} />

        {/* Selected Check */}
        {isSelected && canAccess && (
          <Check className={cn(
            'h-4 w-4 text-blue-600 dark:text-blue-400',
            'transition-all duration-200 scale-100',
            'animate-in fade-in-0 zoom-in-95'
          )} />
        )}
      </div>

      {/* Hover Effect Overlay */}
      <div className={cn(
        'absolute inset-0 rounded-md transition-opacity duration-200',
        'bg-gradient-to-r from-transparent via-blue-50/20 to-transparent',
        'dark:via-blue-900/10 opacity-0',
        canAccess && 'group-hover:opacity-100'
      )} />
    </button>
  )

  // Wrap restricted models with tooltip
  if (!canAccess) {
    return (
      <UpgradeTooltip model={model}>
        {content}
      </UpgradeTooltip>
    )
  }

  return content
}
