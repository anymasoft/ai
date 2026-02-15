/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * segmented-control.tsx
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
import { Tabs, TabsList, TabsTrigger } from '@libra/ui/components/tabs'
import * as React from 'react'

export interface SegmentedControlOption {
  value: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SegmentedControl = React.forwardRef<
  React.ElementRef<typeof Tabs>,
  SegmentedControlProps
>(({ options, value, onValueChange, disabled = false, className, size = 'md' }, ref) => {
  return (
    <Tabs
      ref={ref}
      value={value}
      onValueChange={onValueChange}
      className={cn('w-auto', className)}
    >
      <TabsList
        className={cn(
          // Base styles for segmented control appearance
          'inline-flex items-center justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground',
          'border border-border/40 shadow-sm backdrop-blur-sm',
          'transition-all duration-200 ease-in-out',
          // Size variants
          {
            'h-8 gap-1': size === 'sm',
            'h-9 gap-1': size === 'md', 
            'h-10 gap-1.5': size === 'lg',
          },
          // Disabled state
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            disabled={disabled || option.disabled}
            className={cn(
              // Base trigger styles
              'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium',
              'ring-offset-background transition-all duration-200 ease-in-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:pointer-events-none disabled:opacity-50',
              
              // Size-specific padding and text
              {
                'px-2.5 py-1 text-xs': size === 'sm',
                'px-3 py-1.5 text-sm': size === 'md',
                'px-4 py-2 text-sm': size === 'lg',
              },
              
              // State styles - inactive
              'text-muted-foreground/70 bg-transparent',
              'hover:bg-accent/50 hover:text-accent-foreground transition-colors',
              
              // State styles - active (enhanced visual contrast)
              'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
              'data-[state=active]:shadow-md data-[state=active]:border-0',
              'data-[state=active]:font-semibold',
              
              // Interactive feedback
              'transform hover:scale-[1.02] active:scale-[0.98]',
              'data-[state=active]:hover:bg-primary/90 data-[state=active]:hover:shadow-lg'
            )}
            aria-label={option.label}
          >
            <div className="flex items-center gap-1.5">
              {option.icon && (
                <span className="text-current">
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
})

SegmentedControl.displayName = 'SegmentedControl'

export { SegmentedControl } 