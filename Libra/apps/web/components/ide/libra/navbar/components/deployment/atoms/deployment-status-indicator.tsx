/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-status-indicator.tsx
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

import { cn } from '@libra/ui/lib/utils'

export type DeploymentStatus = 'preparing' | 'deploying' | 'success' | 'error' | 'cancelled'

interface DeploymentStatusIndicatorProps {
  status: DeploymentStatus
  message?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showAnimation?: boolean
}

// Helper function to get status labels
function getStatusLabel(status: DeploymentStatus): string {
  const labels = {
    preparing: '准备中',
    deploying: '部署中',
    success: '部署成功',
    error: '部署失败',
    cancelled: '已取消'
  }
  return labels[status]
}

const statusConfig = {
  preparing: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    indicatorColor: 'bg-blue-500',
    animation: 'animate-pulse'
  },
  deploying: {
    color: 'text-primary',
    bgColor: 'bg-primary/5',
    borderColor: 'border-primary/20',
    indicatorColor: 'bg-gradient-to-r from-primary to-brand',
    animation: 'animate-pulse'
  },
  success: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    indicatorColor: 'bg-green-500',
    animation: ''
  },
  error: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    indicatorColor: 'bg-red-500',
    animation: ''
  },
  cancelled: {
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    indicatorColor: 'bg-gray-500',
    animation: ''
  }
} as const

const sizeConfig = {
  sm: {
    container: 'px-2 py-1',
    indicator: 'w-1.5 h-1.5',
    text: 'deployment-text-caption'
  },
  md: {
    container: 'px-3 py-2',
    indicator: 'w-2 h-2',
    text: 'deployment-text-body'
  },
  lg: {
    container: 'px-4 py-3',
    indicator: 'w-2.5 h-2.5',
    text: 'deployment-text-subtitle'
  }
} as const

export function DeploymentStatusIndicator({
  status,
  message,
  className,
  size = 'md',
  showAnimation = true
}: DeploymentStatusIndicatorProps) {
  const config = statusConfig[status]
  const sizeStyles = sizeConfig[size]
  
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border',
        'transition-all duration-300 ease-out',
        config.bgColor,
        config.borderColor,
        sizeStyles.container,
        className
      )}
      style={{
        borderRadius: 'var(--deployment-radius-xl)',
      }}
      role="status"
      aria-label={`部署状态: ${getStatusLabel(status)}${message ? ` - ${message}` : ''}`}
    >
      {/* Status indicator dot */}
      <div
        className={cn(
          'rounded-full flex-shrink-0',
          config.indicatorColor,
          sizeStyles.indicator,
          showAnimation && config.animation
        )}
        aria-hidden="true"
      />
      
      {/* Status text */}
      <span className={cn(
        'font-medium whitespace-nowrap',
        config.color,
        sizeStyles.text
      )}>
        {message || getStatusLabel(status)}
      </span>
      
      {/* Loading spinner for active states */}
      {showAnimation && (status === 'preparing' || status === 'deploying') && (
        <div
          className={cn(
            'rounded-full border-2 border-current border-t-transparent animate-spin',
            size === 'sm' && 'w-3 h-3',
            size === 'md' && 'w-4 h-4',
            size === 'lg' && 'w-5 h-5'
          )}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

/**
 * Compact version for use in tight spaces
 */
export function CompactStatusIndicator({
  status,
  className,
  showTooltip = true
}: {
  status: DeploymentStatus
  className?: string
  showTooltip?: boolean
}) {
  const config = statusConfig[status]
  
  return (
    <div
      className={cn(
        'w-3 h-3 rounded-full flex-shrink-0',
        config.indicatorColor,
        config.animation,
        className
      )}
      title={showTooltip ? getStatusLabel(status) : undefined}
      aria-label={getStatusLabel(status)}
      role="status"
    />
  )
}

/**
 * Status indicator with progress for deployment stages
 */
export function ProgressStatusIndicator({
  status,
  progress,
  stage,
  className
}: {
  status: DeploymentStatus
  progress?: number
  stage?: string
  className?: string
}) {
  const config = statusConfig[status]
  
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        config.bgColor,
        config.borderColor,
        className
      )}
      style={{
        borderRadius: 'var(--deployment-radius-md)',
      }}
      role="status"
      aria-label={`部署状态: ${getStatusLabel(status)}${progress ? ` - ${progress}%` : ''}`}
    >
      <div className={cn(
        'w-4 h-4 rounded-full flex-shrink-0',
        config.indicatorColor,
        config.animation
      )} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            'deployment-text-subtitle font-medium',
            config.color
          )}>
            {getStatusLabel(status)}
          </span>
          {progress !== undefined && (
            <span className={cn(
              'deployment-text-caption font-bold',
              config.color
            )}>
              {progress}%
            </span>
          )}
        </div>
        {stage && (
          <p className="deployment-text-caption text-muted-foreground mt-1">
            {stage}
          </p>
        )}
      </div>
    </div>
  )
}
