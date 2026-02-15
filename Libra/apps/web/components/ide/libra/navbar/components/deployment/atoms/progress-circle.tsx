/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * progress-circle.tsx
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

interface ProgressCircleProps {
  progress: number
  size?: number
  strokeWidth?: number
  showPercentage?: boolean
  className?: string
}

export function ProgressCircle({
  progress,
  size = 120,
  strokeWidth = 6,
  showPercentage = true,
  className
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`
  
  return (
    <div className={cn('relative inline-flex', className)}>
      {/* Simplified outer glow effect */}
      <div
        className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse"
        aria-hidden="true"
      />

      {/* Optimized SVG Progress Circle */}
      <div className="relative" style={{ willChange: 'transform' }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          role="progressbar"
          aria-label={`部署进度: ${progress}%`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <title>部署进度指示器</title>

          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth - 2}
            className="text-muted/20"
          />

          {/* Progress circle with optimized animation */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            className="transition-all duration-1000 ease-out drop-shadow-lg"
            style={{ willChange: 'stroke-dasharray' }}
          />

          {/* Simplified gradient definition */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--brand)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <span className="text-2xl font-bold text-foreground">
              {progress}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
