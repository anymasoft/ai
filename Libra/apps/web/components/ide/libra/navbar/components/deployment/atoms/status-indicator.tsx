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

'use client'

import { Check, AlertCircle, XCircle, Info, Loader2 } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'loading'

interface StatusIndicatorProps {
  status: StatusType
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  text?: string
  className?: string
}

const statusConfig = {
  success: {
    icon: Check,
    colorClass: 'deployment-status-success',
    defaultText: "成功"
  },
  warning: {
    icon: AlertCircle,
    colorClass: 'deployment-status-warning',
    defaultText: "警告"
  },
  error: {
    icon: XCircle,
    colorClass: 'deployment-status-error',
    defaultText: "错误"
  },
  info: {
    icon: Info,
    colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20',
    defaultText: "信息"
  },
  loading: {
    icon: Loader2,
    colorClass: 'text-muted-foreground animate-pulse',
    defaultText: "加载中"
  }
} as const

const sizeConfig = {
  sm: {
    iconSize: 'w-3 h-3',
    containerSize: 'w-6 h-6',
    textSize: 'text-xs',
    padding: 'px-2 py-1'
  },
  md: {
    iconSize: 'w-4 h-4',
    containerSize: 'w-8 h-8',
    textSize: 'text-sm',
    padding: 'px-3 py-1.5'
  },
  lg: {
    iconSize: 'w-5 h-5',
    containerSize: 'w-10 h-10',
    textSize: 'text-base',
    padding: 'px-4 py-2'
  }
} as const

export function StatusIndicator({
  status,
  size = 'md',
  showText = false,
  text,
  className
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const sizeStyles = sizeConfig[size]
  const Icon = config.icon
  const displayText = text || config.defaultText

  if (showText) {
    return (
      <div className={cn(
        'inline-flex items-center gap-2 rounded-full font-medium',
        config.colorClass,
        sizeStyles.padding,
        sizeStyles.textSize,
        className
      )}>
        <Icon 
          className={cn(
            sizeStyles.iconSize,
            status === 'loading' && 'animate-spin'
          )}
          aria-hidden="true"
        />
        <span>{displayText}</span>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        config.colorClass,
        sizeStyles.containerSize,
        className
      )}
      title={displayText}
      aria-label={displayText}
    >
      <Icon 
        className={cn(
          sizeStyles.iconSize,
          status === 'loading' && 'animate-spin'
        )}
        aria-hidden="true"
      />
    </div>
  )
}
