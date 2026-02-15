/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-deployment-state.ts
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DeploymentStage } from '../deployment-dialog'

/**
 * Deployment state management parameters
 */
interface DeploymentStateParams {
  isDeploying: boolean
  deployResult?: { workerUrl?: string; message?: string } | null
  existingUrl?: string
  open: boolean
}

/**
 * Deployment state management return type
 */
interface DeploymentStateReturn {
  currentStage: DeploymentStage
  hasStartedDeployment: boolean
  resetDeploymentState: () => void
}

/**
 * Stage configuration mapping
 */
interface StageConfig {
  title: string
  description: string
  showHeader: boolean
}

/**
 * Custom hook for managing deployment dialog state
 * Centralizes the complex state logic for better maintainability
 */
export function useDeploymentState({
  isDeploying,
  deployResult,
  existingUrl,
  open
}: DeploymentStateParams): DeploymentStateReturn {
  const [currentStage, setCurrentStage] = useState<DeploymentStage>('confirmation')
  const [hasStartedDeployment, setHasStartedDeployment] = useState(false)

  /**
   * Reset deployment tracking when dialog closes
   */
  useEffect(() => {
    if (!open) {
      setHasStartedDeployment(false)
    }
  }, [open])

  /**
   * Determine current stage based on deployment state
   * Uses a clear priority system for stage determination
   */
  useEffect(() => {
    if (isDeploying) {
      // Priority 1: Currently deploying - always show progress
      setCurrentStage('progress')
      setHasStartedDeployment(true)
    } else if (deployResult?.workerUrl && hasStartedDeployment) {
      // Priority 2: New deployment completed in this session
      setCurrentStage('success')
    } else if (existingUrl && !isDeploying && !hasStartedDeployment) {
      // Priority 3: Existing deployment without new deployment
      setCurrentStage('existing')
    } else {
      // Priority 4: Default confirmation stage
      setCurrentStage('confirmation')
    }
  }, [isDeploying, deployResult, existingUrl, hasStartedDeployment])

  /**
   * Reset deployment state manually
   */
  const resetDeploymentState = useCallback(() => {
    setHasStartedDeployment(false)
    setCurrentStage('confirmation')
  }, [])

  return {
    currentStage,
    hasStartedDeployment,
    resetDeploymentState
  }
}

/**
 * Get stage configuration for dialog content
 */
export function getStageConfig(stage: DeploymentStage): StageConfig {
  const configs: Record<DeploymentStage, StageConfig> = {
    confirmation: {
      title: 'ide.deployment.dialog.deploymentConfirmationTitle',
      description: 'ide.deployment.dialog.deploymentConfirmationDescription',
      showHeader: true
    },
    progress: {
      title: 'ide.deployment.dialog.deploymentInProgress',
      description: 'ide.deployment.dialog.deploymentProgressDescription',
      showHeader: false
    },
    success: {
      title: 'ide.deployment.dialog.deploymentSuccessTitle',
      description: 'ide.deployment.dialog.deploymentSuccessDescription',
      showHeader: false
    },
    existing: {
      title: 'ide.deployment.dialog.projectDeployedTitle',
      description: 'ide.deployment.dialog.projectDeployedDescription',
      showHeader: false
    }
  }

  return configs[stage] || {
    title: 'ide.deployment.dialog.deploymentConfirmationTitle',
    description: 'ide.deployment.dialog.deploymentConfirmationDescription',
    showHeader: true
  }
}
