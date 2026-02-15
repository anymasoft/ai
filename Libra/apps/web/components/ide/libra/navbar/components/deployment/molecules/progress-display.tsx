/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * progress-display.tsx
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

import React from 'react'
import { Zap, Clock } from 'lucide-react'
import { ProgressCircle } from '../atoms'
import { Progress } from '@libra/ui/components/progress'
import { cn } from '@libra/ui/lib/utils'

interface ProgressDisplayProps {
  progress: number
  stage: string
  estimatedTime?: string
  showDetails?: boolean
  className?: string
}

export const ProgressDisplay = React.memo<ProgressDisplayProps>(({
  progress,
  stage,
  estimatedTime,
  showDetails = false,
  className
}) => {
  return (
    <div className={cn('space-y-8 p-6', className)}>
      {/* Hero Section */}
      <div className="deployment-card p-8">
        <div className="flex flex-col items-center space-y-8">
          {/* Circular Progress */}
          <ProgressCircle
            progress={progress}
            size={120}
            showPercentage={true}
          />

          {/* Title and Status */}
          <div className="text-center space-y-4 max-w-md">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                正在部署项目
              </h2>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4 text-brand animate-pulse" />
                <span className="text-sm font-medium">{stage}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="space-y-6">
        <div className="deployment-card p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">
                部署进度
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">进度</span>
                <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  {progress}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-3">
              <Progress
                value={progress}
                className="h-3 bg-muted/50 shadow-inner"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>开始</span>
                <span>完成</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Information Card */}
        <div className="deployment-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-brand/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                ⏱️ 部署过程通常需要 1-3 分钟，请耐心等待
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {stage}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-2 h-2 bg-gradient-to-r from-primary to-brand rounded-full animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">
                  部署进行中...
                </span>
              </div>
              {estimatedTime && (
                <div className="text-xs text-muted-foreground">
                  预计剩余时间: {estimatedTime}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ProgressDisplay.displayName = 'ProgressDisplay'
