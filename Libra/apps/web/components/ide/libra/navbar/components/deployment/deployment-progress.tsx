/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-progress.tsx
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

import { useMemo } from 'react'
import { Zap, Clock } from 'lucide-react'
import { ProgressCircle } from './atoms'
import { ProgressAnnouncer } from './accessibility-helpers'
import { Progress } from '@libra/ui/components/progress'
import * as m from '@/paraglide/messages'

interface DeploymentProgressProps {
  deployProgress: number
  deployStage: string
}

export function DeploymentProgress({
  deployProgress,
  deployStage
}: DeploymentProgressProps) {
  // Determine stage-specific message with enhanced logic
  const stageMessage = useMemo(() => {
    if (deployStage) return deployStage
    if (deployProgress < 20) return m['ide.deployment.progress.stages.startingWorkflow']()
    if (deployProgress < 60) return m['ide.deployment.progress.stages.buildingOptimizing']()
    if (deployProgress < 90) return m['ide.deployment.progress.stages.deployingToNetwork']()
    return m['ide.deployment.progress.stages.almostComplete']()
  }, [deployStage, deployProgress])

  // Calculate estimated time based on progress
  const estimatedTime = useMemo(() => {
    if (deployProgress < 30) return m['ide.deployment.progress.estimatedTime.twoToThreeMinutes']()
    if (deployProgress < 70) return m['ide.deployment.progress.estimatedTime.oneToTwoMinutes']()
    return m['ide.deployment.progress.estimatedTime.lessThanOneMinute']()
  }, [deployProgress])

  return (
    <main
      className="deployment-section flex flex-col"
      style={{ gap: 'var(--deployment-section-gap)' }}
      aria-labelledby="deployment-progress-title"
    >
      {/* Enhanced progress announcer for screen readers */}
      <ProgressAnnouncer
        progress={deployProgress}
        stage={stageMessage}
        isDeploying={true}
      />

      {/* Hero Progress Section */}
      <div className="deployment-card-enhanced text-center">
        <div className="space-y-6">
          {/* Circular Progress with enhanced design */}
          <div className="flex flex-col items-center space-y-4">
            <ProgressCircle
              progress={deployProgress}
              size={100}
              showPercentage={true}
              className="drop-shadow-lg"
            />

            {/* Progress Title */}
            <div className="space-y-2">
              <h2
                id="deployment-progress-title"
                className="deployment-text-title text-foreground"
              >
                {m['ide.deployment.progress.deployingProject']()}
              </h2>

              {/* Current Stage Indicator */}
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 text-primary animate-pulse" aria-hidden="true" />
                <span className="deployment-text-body text-muted-foreground">
                  {stageMessage}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Progress Information */}
      <div className="space-y-4">
        {/* Progress Bar Card */}
        <div className="deployment-card-enhanced">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="deployment-text-subtitle font-semibold text-foreground">
                {m['ide.deployment.progress.deploymentProgress']()}
              </h3>
              <div className="flex items-center gap-2">
                <span className="deployment-text-caption text-muted-foreground">
                  {m['ide.deployment.progress.completed']()}
                </span>
                <span
                  className="deployment-text-subtitle font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20"
                  style={{ borderRadius: 'var(--deployment-radius-xl)' }}
                >
                  {deployProgress}%
                </span>
              </div>
            </div>

            {/* Enhanced Progress Bar */}
            <div className="space-y-3">
              <Progress
                value={deployProgress}
                className="h-3 deployment-progress-bar"
                style={{
                  backgroundColor: 'var(--deployment-progress-bg)',
                }}
              />
              <div className="flex justify-between deployment-text-caption text-muted-foreground font-medium">
                <span>{m['ide.deployment.progress.start']()}</span>
                <span>{m['ide.deployment.progress.complete']()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Time Estimation Card */}
        <div className="deployment-card-enhanced">
          <div className="flex items-start gap-4">
            <div className="deployment-icon-container-enhanced">
              <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="deployment-text-subtitle font-semibold text-foreground">
                ⏱️ {m['ide.deployment.progress.deploymentTime']()}
              </h3>
              <p className="deployment-text-body text-muted-foreground">
                {stageMessage}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--deployment-progress-fill)' }}
                  aria-hidden="true"
                />
                <span className="deployment-text-caption text-muted-foreground font-medium">
                  {m['ide.deployment.progress.deploymentInProgress']()}
                </span>
              </div>
              {estimatedTime && (
                <div className="deployment-text-caption text-muted-foreground">
                  {m['ide.deployment.progress.estimatedTimeRemaining']()}: {estimatedTime}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
