/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * unified-loading-system.tsx
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
import { Skeleton } from '@libra/ui/components/skeleton'
import { Code, FileText, Terminal, MessageSquare } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import * as m from '@/paraglide/messages'

// --------------------------
// Basic type definitions
// --------------------------

/**
 * Loading state type
 */
type LoadingState = 'idle' | 'loading' | 'success' | 'error'

/**
 * Animation intensity type
 */
type AnimationIntensity = 'none' | 'subtle' | 'normal' | 'strong'

/**
 * Base loading component properties
 */
interface BaseLoadingProps {
  /** Custom style class name */
  className?: string
  /** Whether to activate loading state */
  isActive?: boolean
  /** Loading state */
  loadingState?: LoadingState
  /** Animation intensity */
  animationIntensity?: AnimationIntensity
  /** Accessibility label */
  'aria-label'?: string
  /** Accessibility description */
  'aria-describedby'?: string
}

// --------------------------
// Variant system configuration
// --------------------------

/**
 * Skeleton screen variant configuration
 */
const skeletonVariants = cva(
  'animate-pulse transition-opacity duration-300',
  {
    variants: {
      size: {
        sm: 'p-2 space-y-2',
        md: 'p-3 space-y-3',
        lg: 'p-4 space-y-4',
      },
      intensity: {
        none: 'animate-none',
        subtle: 'animate-pulse [animation-duration:3s]',
        normal: 'animate-pulse [animation-duration:2s]',
        strong: 'animate-pulse [animation-duration:1s]',
      },
      state: {
        idle: 'opacity-0',
        loading: 'opacity-100',
        success: 'opacity-0',
        error: 'opacity-50',
      },
    },
    defaultVariants: {
      size: 'md',
      intensity: 'normal',
      state: 'loading',
    },
  }
)

/**
 * Icon container variant configuration
 */
const iconContainerVariants = cva(
  'flex items-center justify-center rounded-full',
  {
    variants: {
      type: {
        message: 'bg-primary/10 text-primary',
        plan: 'bg-warning/10 text-warning',
        command: 'bg-success/10 text-success',
        diff: 'bg-accent/10 text-accent',
        tab: 'bg-muted/50 text-muted-foreground',
      },
      size: {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
      },
    },
    defaultVariants: {
      type: 'message',
      size: 'md',
    },
  }
)

// --------------------------
// Base components
// --------------------------

/**
 * Loading icon component
 */
const LoadingIcon = forwardRef<
  HTMLDivElement,
  {
    type: 'message' | 'plan' | 'command' | 'diff' | 'tab'
    size?: 'sm' | 'md' | 'lg'
    className?: string
  }
>(({ type, size = 'md', className }, ref) => {
  const IconComponent = {
    message: MessageSquare,
    plan: FileText,
    command: Terminal,
    diff: Code,
    tab: MessageSquare,
  }[type]

  const iconSize = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  }[size]

  return (
    <div
      ref={ref}
      className={cn(iconContainerVariants({ type, size }), className)}
      aria-hidden="true"
    >
      <IconComponent className={iconSize} />
    </div>
  )
})
LoadingIcon.displayName = 'LoadingIcon'

/**
 * Responsive skeleton lines component
 */
const SkeletonLines = forwardRef<
  HTMLDivElement,
  {
    count: number
    className?: string
    variant?: 'uniform' | 'varied' | 'paragraph'
  }
>(({ count, className, variant = 'varied' }, ref) => {
  const getLineWidth = (index: number, total: number) => {
    switch (variant) {
      case 'uniform':
        return 'w-full'
      case 'paragraph':
        return index === total - 1 ? 'w-3/4' : 'w-full'
      default: {
        const patterns = ['w-full', 'w-11/12', 'w-4/5', 'w-5/6']
        return patterns[index % patterns.length]
      }
    }
  }

  return (
    <div ref={ref} className={cn('space-y-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-3 transition-all duration-200',
            getLineWidth(i, count),
            // Responsive adjustments
            'sm:h-3.5 md:h-4'
          )}
        />
      ))}
    </div>
  )
})
SkeletonLines.displayName = 'SkeletonLines'

// --------------------------
// Main components
// --------------------------

/**
 * Message skeleton component properties
 */
interface MessageSkeletonProps extends BaseLoadingProps, VariantProps<typeof skeletonVariants> {
  /** Number of text lines */
  lines?: number
  /** Whether to show avatar */
  showAvatar?: boolean
  /** Whether to show timestamp */
  showTimestamp?: boolean
}

/**
 * Message skeleton component
 * Provides placeholder display when messages are loading
 */
export const MessageSkeleton = forwardRef<HTMLDivElement, MessageSkeletonProps>(
  (
    {
      className,
      isActive = true,
      loadingState = 'loading',
      animationIntensity = 'normal',
      size = 'md',
      lines = 4,
      showAvatar = true,
      showTimestamp = false,
      'aria-label': ariaLabel = m['ide.unifiedLoadingSystem.loadingMessage'](),
      'aria-describedby': ariaDescribedby,
      ...props
    },
    ref
  ) => {
    if (!isActive && loadingState !== 'loading') return null

    return (
      <div
        ref={ref}
        className={cn(
          skeletonVariants({ size, intensity: animationIntensity, state: loadingState }),
          className
        )}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-live="polite"
        {...props}
      >
        {/* Message header */}
        <div className="flex items-center space-x-3">
          {showAvatar && (
            <Skeleton className="h-8 w-8 rounded-full sm:h-9 sm:w-9 md:h-10 md:w-10" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24 sm:w-28 md:w-32" />
            {showTimestamp && (
              <Skeleton className="h-3 w-16 sm:w-20" />
            )}
          </div>
          <LoadingIcon type="message" size={size === 'lg' ? 'lg' : 'md'} />
        </div>

        {/* Message content */}
        <SkeletonLines
          count={lines}
          variant="paragraph"
          className="pl-11 sm:pl-12 md:pl-13"
        />

        {/* Message action area */}
        <div className="flex items-center justify-between pt-2 pl-11 sm:pl-12 md:pl-13">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    )
  }
)
MessageSkeleton.displayName = 'MessageSkeleton'

/**
 * Plan skeleton component properties
 */
interface PlanSkeletonProps extends BaseLoadingProps, VariantProps<typeof skeletonVariants> {
  /** Number of plan steps */
  steps?: number
  /** Number of description lines */
  descriptionLines?: number
}

/**
 * Plan skeleton component
 * Provides placeholder display when plan content is loading
 */
export const PlanSkeleton = forwardRef<HTMLDivElement, PlanSkeletonProps>(
  (
    {
      className,
      isActive = true,
      loadingState = 'loading',
      animationIntensity = 'normal',
      size = 'md',
      steps = 3,
      descriptionLines = 6,
      'aria-label': ariaLabel = m['ide.unifiedLoadingSystem.loadingPlan'](),
      'aria-describedby': ariaDescribedby,
      ...props
    },
    ref
  ) => {
    if (!isActive && loadingState !== 'loading') return null

    return (
      <div
        ref={ref}
        className={cn(
          skeletonVariants({ size, intensity: animationIntensity, state: loadingState }),
          className
        )}

        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-live="polite"
        {...props}
      >
        {/* Plan header */}
        <div className="flex items-center space-x-3">
          <LoadingIcon type="plan" size={size === 'lg' ? 'lg' : 'md'} />
          <Skeleton className="h-5 w-32 sm:w-36 md:w-40" />
        </div>

        {/* Plan description */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-3/4 sm:w-4/5" />
          <SkeletonLines count={descriptionLines} variant="varied" />
        </div>

        {/* Plan steps */}
        <div className="space-y-4 pt-2">
          {Array.from({ length: steps }, (_, i) => (
            <div key={`step-${i}`} className="flex items-start space-x-3">
              <div className="mt-1">
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full sm:w-11/12" />
                <Skeleton className="h-3 w-4/5 sm:w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
)
PlanSkeleton.displayName = 'PlanSkeleton'

/**
 * Command skeleton component properties
 */
interface CommandSkeletonProps extends BaseLoadingProps, VariantProps<typeof skeletonVariants> {
  /** Number of commands */
  commands?: number
}

/**
 * Command skeleton component
 * Provides placeholder display when command content is loading
 */
export const CommandSkeleton = forwardRef<HTMLDivElement, CommandSkeletonProps>(
  (
    {
      className,
      isActive = true,
      loadingState = 'loading',
      animationIntensity = 'normal',
      size = 'md',
      commands = 3,
      'aria-label': ariaLabel = m['ide.unifiedLoadingSystem.loadingCommands'](),
      'aria-describedby': ariaDescribedby,
      ...props
    },
    ref
  ) => {
    if (!isActive && loadingState !== 'loading') return null

    return (
      <div
        ref={ref}
        className={cn(
          skeletonVariants({ size, intensity: animationIntensity, state: loadingState }),
          className
        )}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-live="polite"
        {...props}
      >
        {/* Command header */}
        <div className="flex items-center space-x-3">
          <LoadingIcon type="command" size={size === 'lg' ? 'lg' : 'md'} />
          <Skeleton className="h-5 w-32 sm:w-36 md:w-40" />
        </div>

        {/* Command list */}
        <div className="space-y-4">
          {Array.from({ length: commands }, (_, i) => (
            <div key={`command-${i}`} className="space-y-2">
              <Skeleton className="h-8 w-full rounded-md bg-muted/50 sm:h-9 md:h-10" />
              <Skeleton className="h-3 w-4/5 sm:w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }
)
CommandSkeleton.displayName = 'CommandSkeleton'

/**
 * Code diff skeleton component properties
 */
interface DiffSkeletonProps extends BaseLoadingProps, VariantProps<typeof skeletonVariants> {
  /** Number of code lines */
  codeLines?: number
  /** Whether to show file path */
  showFilePath?: boolean
}

/**
 * Code diff skeleton component
 * Provides placeholder display when code diff content is loading
 */
export const DiffSkeleton = forwardRef<HTMLDivElement, DiffSkeletonProps>(
  (
    {
      className,
      isActive = true,
      loadingState = 'loading',
      animationIntensity = 'normal',
      size = 'md',
      codeLines = 10,
      showFilePath = true,
      'aria-label': ariaLabel = m['ide.unifiedLoadingSystem.loadingCodeChanges'](),
      'aria-describedby': ariaDescribedby,
      ...props
    },
    ref
  ) => {
    if (!isActive && loadingState !== 'loading') return null

    return (
      <div
        ref={ref}
        className={cn(
          skeletonVariants({ size, intensity: animationIntensity, state: loadingState }),
          className
        )}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-live="polite"
        {...props}
      >
        {/* Code diff header */}
        <div className="flex items-center space-x-3">
          <LoadingIcon type="diff" size={size === 'lg' ? 'lg' : 'md'} />
          <Skeleton className="h-5 w-36 sm:w-40 md:w-44" />
        </div>

        {/* File path */}
        {showFilePath && (
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-3/4 rounded-md bg-muted/30" />
          </div>
        )}

        {/* Code diff content */}
        <div className="space-y-1 border border-border/50 rounded-md p-3 bg-muted/20">
          {Array.from({ length: codeLines }, (_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-6 text-center">
                <Skeleton 
                  className={cn(
                    "h-3 w-3 mx-auto rounded-sm",
                    // Simulate code diff color patterns
                    i % 4 === 0 && "bg-success/30",
                    i % 4 === 1 && "bg-destructive/30",
                    i % 4 === 2 && "bg-muted/50"
                  )} 
                />
              </div>
              <Skeleton 
                className={cn(
                  "h-3 font-mono",
                  // Simulate different lengths of code lines
                  i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-4/5" : "w-2/3"
                )} 
              />
            </div>
          ))}
        </div>
      </div>
    )
  }
)
DiffSkeleton.displayName = 'DiffSkeleton'

/**
 * Tab loading indicator component properties
 */
interface TabLoadingIndicatorProps extends BaseLoadingProps, VariantProps<typeof skeletonVariants> {
  /** Number of tabs */
  tabCount?: number
  /** Whether to show action buttons */
  showActions?: boolean
}

/**
 * Tab loading indicator component
 * Provides loading state indication for Tab navigation
 */
export const TabLoadingIndicator = forwardRef<HTMLDivElement, TabLoadingIndicatorProps>(
  (
    {
      className,
      isActive = true,
      loadingState = 'loading',
      animationIntensity = 'normal',
      size = 'md',
      tabCount = 3,
      showActions = true,
      'aria-label': ariaLabel = m['ide.unifiedLoadingSystem.loadingTabs'](),
      'aria-describedby': ariaDescribedby,
      ...props
    },
    ref
  ) => {
    if (!isActive && loadingState !== 'loading') return null

    const tabWidths = ['w-20', 'w-24', 'w-16', 'w-28', 'w-18']

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between transition-opacity duration-300',
          size === 'sm' ? 'p-2' : size === 'lg' ? 'p-4' : 'p-3',
          loadingState === 'loading' ? 'opacity-100' : 'opacity-0',
          className
        )}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-live="polite"
        {...props}
      >
        {/* Tab list */}
        <div className="flex items-center gap-2">
          {Array.from({ length: tabCount }, (_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-7 rounded-full transition-all duration-200',
                tabWidths[i % tabWidths.length],
                animationIntensity === 'strong' && 'animate-pulse [animation-duration:1s]',
                animationIntensity === 'subtle' && 'animate-pulse [animation-duration:3s]',
                animationIntensity === 'none' && 'animate-none'
              )}
            />
          ))}
        </div>

        {/* Action area */}
        {showActions && (
          <div className="flex items-center space-x-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
        )}
      </div>
    )
  }
)
TabLoadingIndicator.displayName = 'TabLoadingIndicator'

// --------------------------
// Composite components
// --------------------------

/**
 * Unified loading system component properties
 */
interface UnifiedLoadingSystemProps extends BaseLoadingProps {
  /** Loading type */
  type: 'message' | 'plan' | 'command' | 'diff' | 'tab'
  /** Component size */
  size?: 'sm' | 'md' | 'lg'
  /** Type-specific properties */
  typeProps?: Partial<MessageSkeletonProps & PlanSkeletonProps & CommandSkeletonProps & DiffSkeletonProps & TabLoadingIndicatorProps>
}

/**
 * Unified loading system component
 * Automatically selects appropriate loading component based on type
 */
export const UnifiedLoadingSystem = forwardRef<HTMLDivElement, UnifiedLoadingSystemProps>(
  (
    {
      type,
      size = 'md',
      className,
      isActive = true,
      loadingState = 'loading',
      animationIntensity = 'normal',
      typeProps = {},
      ...props
    },
    ref
  ) => {
    const commonProps = {
      ref,
      className,
      isActive,
      loadingState,
      animationIntensity,
      size,
      ...props,
      ...typeProps,
    }

    switch (type) {
      case 'message':
        return <MessageSkeleton {...commonProps} />
      case 'plan':
        return <PlanSkeleton {...commonProps} />
      case 'command':
        return <CommandSkeleton {...commonProps} />
      case 'diff':
        return <DiffSkeleton {...commonProps} />
      case 'tab':
        return <TabLoadingIndicator {...commonProps} />
      default:
        return <MessageSkeleton {...commonProps} />
    }
  }
)
UnifiedLoadingSystem.displayName = 'UnifiedLoadingSystem'

// --------------------------
// Export types
// --------------------------

export type {
  LoadingState,
  AnimationIntensity,
  BaseLoadingProps,
  MessageSkeletonProps,
  PlanSkeletonProps,
  CommandSkeletonProps,
  DiffSkeletonProps,
  TabLoadingIndicatorProps,
  UnifiedLoadingSystemProps,
}
