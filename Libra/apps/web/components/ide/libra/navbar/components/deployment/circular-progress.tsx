/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * circular-progress.tsx
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

import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'

interface CircularProgressProps {
  progress: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'gradient' | 'glass'
  showPercentage?: boolean
  showIcon?: boolean
  className?: string
  'aria-label'?: string
}

const sizeConfig = {
  sm: {
    container: 'h-16 w-16',
    svg: 'w-16 h-16',
    loader: 'h-6 w-6',
    text: 'text-xs',
    strokeWidth: 2,
    radius: 28
  },
  md: {
    container: 'h-20 w-20',
    svg: 'w-20 h-20',
    loader: 'h-8 w-8',
    text: 'text-sm',
    strokeWidth: 3,
    radius: 36
  },
  lg: {
    container: 'h-24 w-24',
    svg: 'w-24 h-24',
    loader: 'h-10 w-10',
    text: 'text-sm',
    strokeWidth: 3,
    radius: 44
  },
  xl: {
    container: 'h-32 w-32',
    svg: 'w-32 h-32',
    loader: 'h-12 w-12',
    text: 'text-base',
    strokeWidth: 4,
    radius: 60
  }
}

export function CircularProgress({
  progress,
  size = 'md',
  variant = 'gradient',
  showPercentage = true,
  showIcon = true,
  className,
  'aria-label': ariaLabel
}: CircularProgressProps) {
  const config = sizeConfig[size]
  const { radius } = config

  // Calculate accurate circle properties
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (progress / 100) * circumference

  // Variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'gradient':
        return {
          container: 'glass-2 border border-border/30',
          background: 'bg-gradient-to-br from-primary/5 via-brand/5 to-primary/5',
          glow: 'shadow-lg shadow-primary/20'
        }
      case 'glass':
        return {
          container: 'glass-3 border border-border/20',
          background: 'bg-gradient-to-br from-background/80 to-background/60',
          glow: 'shadow-xl shadow-black/10'
        }
      default:
        return {
          container: 'border border-border/50',
          background: 'bg-background',
          glow: 'shadow-md'
        }
    }
  }

  const variantStyles = getVariantStyles()

  return (
    <div
      className={cn("relative", config.container, className)}
      role="img"
      aria-label={ariaLabel || `进度: ${progress}%`}
    >
      {/* Outer glow effect */}
      {variant === 'gradient' && (
        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-primary/20 via-brand/20 to-primary/20 blur-xl animate-pulse" />
      )}

      {/* Main container */}
      <div className={cn(
        "rounded-full flex items-center justify-center relative",
        variantStyles.container,
        variantStyles.background,
        variantStyles.glow,
        config.container
      )}>
        {/* Animated loader icon */}
        {showIcon && (
          <Loader2
            className={cn("animate-spin text-primary", config.loader)}
            aria-hidden="true"
          />
        )}
      </div>

      {/* SVG Progress Ring */}
      <svg
        className={cn("absolute inset-0 transform -rotate-90", config.svg)}
        aria-hidden="true"
        role="img"
        aria-label={`进度环: ${progress}%`}
      >
        <title>进度指示器</title>
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted/20"
        />
        {/* Progress circle with gradient */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke={variant === 'gradient' ? "url(#progressGradient)" : "currentColor"}
          strokeWidth={config.strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-primary transition-all duration-1000 ease-out drop-shadow-lg"
        />
        {/* Gradient definition for enhanced visual */}
        {variant === 'gradient' && (
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="50%" stopColor="var(--brand)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
        )}
      </svg>

      {/* Percentage display */}
      {showPercentage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-bold text-foreground",
              config.text
            )}
            aria-hidden="true"
          >
            {progress}%
          </span>
        </div>
      )}
    </div>
  )
}
