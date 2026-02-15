/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * plan-badge.tsx
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

import * as m from '@/paraglide/messages'
import { Crown, Sparkles } from 'lucide-react'
import { Badge } from '@libra/ui/components/badge'
import { PLAN_TYPES, type PlanType } from '@/configs/ai-models'
import { cn } from '@libra/ui/lib/utils'

interface PlanBadgeProps {
  requiredPlan: PlanType
  className?: string
}

export const PlanBadge = ({ requiredPlan, className }: PlanBadgeProps) => {
  // Don't show badge for free plan
  if (requiredPlan === PLAN_TYPES.FREE) {
    return null
  }

  const getBadgeConfig = (plan: PlanType) => {
    switch (plan) {
      case PLAN_TYPES.PRO:
        return {
          label: m["chatPanel.modelItem.planBadge.pro"](),
          icon: Crown,
          variant: 'secondary' as const,
          className: cn(
            'bg-gradient-to-r from-amber-500/10 to-orange-500/10',
            'text-amber-700 dark:text-amber-300',
            'border-amber-200/50 dark:border-amber-800/50',
            'shadow-sm'
          )
        }
      case PLAN_TYPES.MAX:
        return {
          label: m["chatPanel.modelItem.planBadge.max"](),
          icon: Sparkles,
          variant: 'default' as const,
          className: cn(
            'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
            'text-purple-700 dark:text-purple-300',
            'border-purple-200/50 dark:border-purple-800/50',
            'shadow-sm'
          )
        }
      default:
        return null
    }
  }

  const config = getBadgeConfig(requiredPlan)
  if (!config) return null

  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs px-2 py-0.5 h-5 font-semibold',
        'transition-all duration-200',
        'hover:scale-105 hover:shadow-md',
        'flex items-center gap-1',
        config.className,
        className
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  )
}
