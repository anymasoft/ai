/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * status-indicator.tsx
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

import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'

export type UsageStatus = 'normal' | 'warning' | 'danger'

interface StatusIndicatorProps {
  status: UsageStatus
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export function StatusIndicator({ 
  status, 
  size = 'md', 
  showIcon = true,
  className 
}: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'danger':
        return {
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          icon: AlertTriangle,
          label: 'Critical'
        }
      case 'warning':
        return {
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/20',
          icon: AlertTriangle,
          label: 'Warning'
        }
      default:
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          icon: CheckCircle,
          label: 'Normal'
        }
    }
  }

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return {
          iconSize: 'h-3 w-3',
          padding: 'p-1'
        }
      case 'lg':
        return {
          iconSize: 'h-5 w-5',
          padding: 'p-2'
        }
      default:
        return {
          iconSize: 'h-4 w-4',
          padding: 'p-1.5'
        }
    }
  }

  const statusConfig = getStatusConfig()
  const sizeConfig = getSizeConfig()
  const Icon = statusConfig.icon

  if (!showIcon) {
    return (
      <div 
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          statusConfig.bgColor,
          sizeConfig.padding,
          className
        )}
        aria-label={statusConfig.label}
      >
        <div 
          className={cn(
            'rounded-full',
            statusConfig.color.replace('text-', 'bg-'),
            size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2'
          )}
        />
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        statusConfig.bgColor,
        sizeConfig.padding,
        className
      )}
      aria-label={statusConfig.label}
    >
      <Icon className={cn(statusConfig.color, sizeConfig.iconSize)} />
    </div>
  )
}

// Utility function to determine status based on usage
export function getUsageStatus(used: number, total: number): UsageStatus {
  if (total <= 0) return 'normal'
  
  const percentage = (used / total) * 100
  
  if (percentage >= 90) return 'danger'
  if (percentage >= 70) return 'warning'
  return 'normal'
}
