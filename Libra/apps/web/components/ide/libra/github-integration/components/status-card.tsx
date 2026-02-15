/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * status-card.tsx
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

import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, Check, Info, Loader2 } from 'lucide-react'

import { cn } from '@libra/ui/lib/utils'

const statusCardVariants = cva(
  'flex items-center gap-4 p-4 rounded-xl border transition-all duration-200',
  {
    variants: {
      variant: {
        success: [
          'bg-green-50/80 dark:bg-green-950/30',
          'border-green-200/60 dark:border-green-800/60',
          'hover:bg-green-50 dark:hover:bg-green-950/40',
          'hover:border-green-300/60 dark:hover:border-green-700/60'
        ],
        info: [
          'bg-blue-50/80 dark:bg-blue-950/30',
          'border-blue-200/60 dark:border-blue-800/60',
          'hover:bg-blue-50 dark:hover:bg-blue-950/40',
          'hover:border-blue-300/60 dark:hover:border-blue-700/60'
        ],
        warning: [
          'bg-amber-50/80 dark:bg-amber-950/30',
          'border-amber-200/60 dark:border-amber-800/60',
          'hover:bg-amber-50 dark:hover:bg-amber-950/40',
          'hover:border-amber-300/60 dark:hover:border-amber-700/60'
        ],
        loading: [
          'bg-muted/50 dark:bg-muted/30',
          'border-border/60',
          'hover:bg-muted/60 dark:hover:bg-muted/40',
          'hover:border-border/80'
        ]
      },
      size: {
        default: 'p-4',
        sm: 'p-3',
        lg: 'p-5'
      }
    },
    defaultVariants: {
      variant: 'info',
      size: 'default'
    }
  }
)

const statusIconVariants = cva(
  'flex items-center justify-center rounded-full shrink-0 transition-colors',
  {
    variants: {
      variant: {
        success: [
          'bg-green-100/80 dark:bg-green-900/40',
          'text-green-600 dark:text-green-400',
          'border border-green-200/60 dark:border-green-800/60'
        ],
        info: [
          'bg-blue-100/80 dark:bg-blue-900/40',
          'text-blue-600 dark:text-blue-400',
          'border border-blue-200/60 dark:border-blue-800/60'
        ],
        warning: [
          'bg-amber-100/80 dark:bg-amber-900/40',
          'text-amber-600 dark:text-amber-400',
          'border border-amber-200/60 dark:border-amber-800/60'
        ],
        loading: [
          'bg-background dark:bg-muted/50',
          'text-primary',
          'border border-border/60'
        ]
      },
      size: {
        default: 'w-10 h-10',
        sm: 'w-8 h-8',
        lg: 'w-12 h-12'
      }
    },
    defaultVariants: {
      variant: 'info',
      size: 'default'
    }
  }
)

const getTextStyles = (variant: 'success' | 'info' | 'warning' | 'loading') => {
  switch (variant) {
    case 'success':
      return {
        title: 'text-green-800 dark:text-green-200',
        description: 'text-green-700 dark:text-green-300'
      }
    case 'info':
      return {
        title: 'text-blue-800 dark:text-blue-200',
        description: 'text-blue-700 dark:text-blue-300'
      }
    case 'warning':
      return {
        title: 'text-amber-800 dark:text-amber-200',
        description: 'text-amber-700 dark:text-amber-300'
      }
    case 'loading':
      return {
        title: 'text-foreground',
        description: 'text-muted-foreground'
      }
    default:
      return {
        title: 'text-foreground',
        description: 'text-muted-foreground'
      }
  }
}

interface StatusCardProps extends VariantProps<typeof statusCardVariants> {
  title: string
  description: string
  icon?: React.ReactNode
  className?: string
}

export function StatusCard({
  variant = 'info',
  size = 'default',
  title,
  description,
  icon,
  className
}: StatusCardProps) {
  const getDefaultIcon = () => {
    const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'

    switch (variant) {
      case 'success':
        return <Check className={iconSize} aria-hidden="true" />
      case 'info':
        return <Info className={iconSize} aria-hidden="true" />
      case 'warning':
        return <AlertCircle className={iconSize} aria-hidden="true" />
      case 'loading':
        return <Loader2 className={cn(iconSize, 'animate-spin')} aria-hidden="true" />
      default:
        return <Info className={iconSize} aria-hidden="true" />
    }
  }

  const textStyles = getTextStyles(variant || 'info')

  return (
    <div
      className={cn(statusCardVariants({ variant, size }), className)}
      role={variant === 'warning' ? 'alert' : 'status'}
      aria-live={variant === 'loading' ? 'polite' : undefined}
    >
      <div className={statusIconVariants({ variant, size })}>
        {icon || getDefaultIcon()}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <h3 className={cn(
          'font-semibold leading-tight',
          size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-sm',
          textStyles.title
        )}>
          {title}
        </h3>
        <p className={cn(
          'leading-relaxed',
          size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs',
          textStyles.description
        )}>
          {description}
        </p>
      </div>
    </div>
  )
}
