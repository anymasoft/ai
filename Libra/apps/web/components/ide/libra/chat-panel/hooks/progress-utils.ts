/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * progress-utils.ts
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

import { useCallback } from 'react'
import type { LoadingStage, DetailedLoadingStatus, EnhancedProgressState } from '../types'

/**
 * Progress animation and loading stage management tools
 */
export const createProgressManager = (
  setCurrentStage: (stage: LoadingStage) => void,
  setStageProgress: (cb: (prev: Record<LoadingStage, number>) => Record<LoadingStage, number>) => void,
  setLoading: (status: DetailedLoadingStatus) => void,
  animationConfig: { progressUpdateInterval: number | undefined },
  stageProgress: Record<LoadingStage, number>
) => {
  // Easing function
  const easeOutQuart = (x: number): number => {
    return 1 - (1 - x) ** 4
  }

  // Get estimated duration for each stage
  const getEstimatedDuration = (stage: LoadingStage): number => {
    switch (stage) {
      case 'thinking': return 8000
      case 'description': return 5000  
      case 'actions': return 10000
      case 'complete': return 0
      default: return 5000
    }
  }

  // Start progress simulation
  const startProgressSimulation = useCallback((
    planId: string, 
    stage: LoadingStage,
    progressRef: React.MutableRefObject<Record<string, EnhancedProgressState>>,
    stageTimersRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>
  ) => {
    const updateInterval = animationConfig.progressUpdateInterval || 1500
    let currentProgress = stageProgress[stage] || 0

    stageTimersRef.current[planId] = setInterval(() => {
      const progressState = progressRef.current[planId]
      if (!progressState || !progressState.isActive) {
        clearInterval(stageTimersRef.current[planId])
        return
      }

      const elapsedTime = Date.now() - progressState.startTime
      const estimatedDuration = progressState.estimatedDuration || 5000
      const timeProgress = Math.min(elapsedTime / estimatedDuration, 1)
      
      // Use externally defined easeOutQuart to avoid dependency issues
      const easedProgress = (1 - (1 - timeProgress) ** 4) * 85
      currentProgress = Math.max(currentProgress, Math.floor(easedProgress))

      if (currentProgress < 95) {
        setStageProgress(prev => ({
          ...prev,
          [stage]: currentProgress
        }))

        progressRef.current[planId] = {
          ...progressState,
          progress: currentProgress
        }
      }
    }, updateInterval)
  }, [animationConfig.progressUpdateInterval, stageProgress, setStageProgress])

  // Update loading stage
  const updateLoadingStage = useCallback((
    planId: string, 
    newStage: LoadingStage, 
    progress: number,
    progressRef: React.MutableRefObject<Record<string, EnhancedProgressState>>,
    stageTimersRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>
  ) => {
    if (stageTimersRef.current[planId]) {
      clearInterval(stageTimersRef.current[planId])
    }

    setCurrentStage(newStage)
    
    setStageProgress(prev => ({
      ...prev,
      [newStage]: progress
    }))

    const detailedStatus: DetailedLoadingStatus = 
      progress === 0 ? `${newStage}_start` as DetailedLoadingStatus :
      progress === 100 ? `${newStage}_complete` as DetailedLoadingStatus :
      `${newStage}_progress` as DetailedLoadingStatus

    setLoading(detailedStatus)

    // Use stage duration estimation function
    let estimatedDuration = 5000;
    switch (newStage) {
      case 'thinking': estimatedDuration = 8000; break;
      case 'description': estimatedDuration = 5000; break;
      case 'actions': estimatedDuration = 10000; break;
      case 'complete': estimatedDuration = 0; break;
    }

    progressRef.current[planId] = {
      stage: newStage,
      progress,
      isActive: progress < 100,
      startTime: Date.now(),
      estimatedDuration: estimatedDuration
    }

    if (progress < 100 && newStage !== 'complete') {
      startProgressSimulation(planId, newStage, progressRef, stageTimersRef)
    }
  }, [setLoading, setCurrentStage, startProgressSimulation, setStageProgress])

  return {
    updateLoadingStage,
    startProgressSimulation,
    easeOutQuart,
    getEstimatedDuration
  }
} 