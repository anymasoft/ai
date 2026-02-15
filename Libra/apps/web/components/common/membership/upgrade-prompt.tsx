/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * upgrade-prompt.tsx
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

import { Sparkles, ArrowRight, Crown, Zap } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { Card, CardContent } from '@libra/ui/components/card'
import { cn } from '@libra/ui/lib/utils'

/**
 * Upgrade prompt variant types
 */
export type UpgradeVariant = 'card' | 'banner' | 'inline' | 'modal'

/**
 * Upgrade prompt props
 */
export interface UpgradePromptProps {
  title?: string
  message: string
  variant?: UpgradeVariant
  onUpgrade: () => void
  className?: string
  showIcon?: boolean
  buttonText?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Unified upgrade prompt component
 * Provides consistent upgrade messaging across the application
 */
export function UpgradePrompt({
  title = 'Premium Feature',
  message,
  variant = 'card',
  onUpgrade,
  className,
  showIcon = true,
  buttonText = 'Upgrade',
  size = 'md',
}: UpgradePromptProps) {
  const sizeClasses = {
    sm: {
      container: 'p-3',
      title: 'text-sm font-semibold',
      message: 'text-xs',
      button: 'h-8 px-3 text-xs',
      icon: 'w-4 h-4',
    },
    md: {
      container: 'p-4',
      title: 'text-sm font-semibold',
      message: 'text-xs',
      button: 'h-9 px-4 text-sm',
      icon: 'w-5 h-5',
    },
    lg: {
      container: 'p-6',
      title: 'text-base font-semibold',
      message: 'text-sm',
      button: 'h-10 px-6 text-sm',
      icon: 'w-6 h-6',
    },
  }

  const sizes = sizeClasses[size]

  // Card variant (default)
  if (variant === 'card') {
    return (
      <Card className={cn(
        'border-2 border-dashed border-orange-200 dark:border-orange-800/50',
        'bg-gradient-to-r from-orange-50/50 to-amber-50/50',
        'dark:from-orange-950/20 dark:to-amber-950/20',
        'transition-all duration-300 hover:shadow-md',
        className
      )}>
        <CardContent className={sizes.container}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {showIcon && (
                <div className={cn(
                  'flex-shrink-0 rounded-full flex items-center justify-center',
                  'bg-gradient-to-br from-orange-400 to-amber-500',
                  'text-white shadow-lg',
                  size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
                )}>
                  <Sparkles className={sizes.icon} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className={cn(sizes.title, 'text-foreground')}>
                  {title}
                </h3>
                <p className={cn(sizes.message, 'text-muted-foreground mt-1')}>
                  {message}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={onUpgrade}
                size={size === 'sm' ? 'sm' : 'default'}
                className={cn(
                  'bg-gradient-to-r from-orange-500 to-amber-500',
                  'hover:from-orange-600 hover:to-amber-600',
                  'text-white font-medium',
                  'shadow-lg hover:shadow-xl',
                  'transition-all duration-200',
                  'group',
                  sizes.button
                )}
              >
                <span className="mr-2">{buttonText}</span>
                <ArrowRight className={cn(
                  'transition-transform group-hover:translate-x-1',
                  size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
                )} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Banner variant
  if (variant === 'banner') {
    return (
      <div className={cn(
        'w-full border-l-4 border-orange-500',
        'bg-gradient-to-r from-orange-50 to-amber-50',
        'dark:from-orange-950/30 dark:to-amber-950/30',
        'transition-all duration-300',
        sizes.container,
        className
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {showIcon && <Crown className={cn(sizes.icon, 'text-orange-600')} />}
            <div>
              <h3 className={cn(sizes.title, 'text-foreground')}>{title}</h3>
              <p className={cn(sizes.message, 'text-muted-foreground')}>{message}</p>
            </div>
          </div>
          <Button
            onClick={onUpgrade}
            variant="outline"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn(
              'border-orange-300 text-orange-700 hover:bg-orange-100',
              'dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/50',
              sizes.button
            )}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    )
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg',
        'bg-orange-50 dark:bg-orange-950/20',
        'border border-orange-200 dark:border-orange-800/50',
        className
      )}>
        {showIcon && <Zap className={cn(sizes.icon, 'text-orange-600')} />}
        <span className={cn(sizes.message, 'text-orange-800 dark:text-orange-200 flex-1')}>
          {message}
        </span>
        <Button
          onClick={onUpgrade}
          size="sm"
          variant="ghost"
          className="text-orange-700 hover:text-orange-800 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-950/50"
        >
          {buttonText}
        </Button>
      </div>
    )
  }

  // Modal variant (simplified for use in dialogs)
  return (
    <div className={cn(
      'text-center space-y-4',
      sizes.container,
      className
    )}>
      {showIcon && (
        <div className="flex justify-center">
          <div className={cn(
            'rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-orange-400 to-amber-500',
            'text-white shadow-lg',
            size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'
          )}>
            <Sparkles className={size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'} />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className={cn(sizes.title, 'text-foreground')}>{title}</h3>
        <p className={cn(sizes.message, 'text-muted-foreground')}>{message}</p>
      </div>
      <Button
        onClick={onUpgrade}
        className={cn(
          'bg-gradient-to-r from-orange-500 to-amber-500',
          'hover:from-orange-600 hover:to-amber-600',
          'text-white font-medium shadow-lg hover:shadow-xl',
          'transition-all duration-200',
          sizes.button
        )}
      >
        {buttonText}
      </Button>
    </div>
  )
}
