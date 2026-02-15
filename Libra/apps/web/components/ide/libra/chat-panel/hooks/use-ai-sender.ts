/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-ai-sender.ts
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

import { llmGenerate } from '@/components/ide/libra/chat-panel/components/clients/https/project'
import { useCallback, useState, useRef } from 'react'
import type { FileType, HistoryType, ThinkingMessageType, UserMessageType } from '@libra/common'
import { log, tryCatch } from '@libra/common'
import type { DetailedLoadingStatus, LoadingStage, AnimationConfig, EnhancedProgressState } from '../types'
import { createProgressManager } from './progress-utils'
import { createResponseProcessor } from './ai-response-processor'
import { createRequestManager } from './request-manager'
import { createId } from '@paralleldrive/cuid2'

type HandlerType = {
  handleThinkingMessage: (message: any, planId: string) => Promise<void>
  handleThinkingCompleteMessage: (message: any, planId: string) => Promise<void>
  handleDescriptionMessage: (message: any, planId: string) => Promise<void>
  handleDescriptionCompleteMessage: (message: any, planId: string) => Promise<void>
  clearAccumulatorForPlan: (planId: string) => void
  accumulatorRef: React.MutableRefObject<any>
}

type ProcessorType = {
  handleCommandMessage: (message: any, planId: string) => Promise<void>
  handleFileUpdates: (fileUpdates: FileType[], planId: string) => Promise<void>
}

export const useAISender = (
  projectId: string, setMessages: React.Dispatch<React.SetStateAction<HistoryType>>,
  setHistory: React.Dispatch<React.SetStateAction<HistoryType>>,
  setLoading: React.Dispatch<React.SetStateAction<DetailedLoadingStatus>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>, isLoading: boolean,
  updateHistoryMutation: any, streamingHandlers: HandlerType,
  messageProcessors: ProcessorType, options: { sendDefaultThinkingMessage?: boolean },
  onFileContentUpdate?: (path: string, content: string) => void,
  deployChanges?: () => Promise<void>,
  selectedModelId?: string
) => {
  // State and references
  const [currentStage, setCurrentStage] = useState<LoadingStage>('thinking')
  const [stageProgress, setStageProgress] = useState<Record<LoadingStage, number>>({
    thinking: 0, description: 0, actions: 0, complete: 0
  })
  const [animationConfig] = useState<AnimationConfig & { progressUpdateInterval: number }>({
    breathingDuration: 800, progressUpdateInterval: 1500, stageTransitionDuration: 500,
    shimmerCycleDuration: 600, enableParticleEffects: true, intensityMultiplier: 1.0
  })
  const [isStopping, setIsStopping] = useState(false)
  
  const progressRef = useRef<Record<string, EnhancedProgressState>>({})
  const stageTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  const activeRequestsRef = useRef<Set<string>>(new Set())
  const currentAbortControllerRef = useRef<AbortController | null>(null)

  const progressManager = createProgressManager(
    setCurrentStage, setStageProgress, setLoading, animationConfig, stageProgress
  )
  
  const requestManager = createRequestManager(
    projectId, isLoading, setIsLoading, setLoading, setMessages, setHistory,
    (planId, stage, progress) => progressManager.updateLoadingStage(
      planId, stage as LoadingStage, progress, progressRef, stageTimersRef
    ),
    activeRequestsRef, { current: { lastContent: null, lastTimestamp: 0, isProcessing: false } }, currentAbortControllerRef, setIsStopping
  )

  const responseProcessor = createResponseProcessor(
    streamingHandlers, messageProcessors,
    {
      updateLoadingStage: (planId, stage, progress) =>
        progressManager.updateLoadingStage(
          planId, stage as LoadingStage, progress, progressRef, stageTimersRef
        ),
      setLoading, setIsLoading, setMessages
    },
    projectId, updateHistoryMutation, currentAbortControllerRef,
    { progressRef, stageTimersRef }, onFileContentUpdate, deployChanges
  )

  // Send message to AI
  const sendMessageToAI = useCallback(async (content: string, selectedItems: any[] = [],
    fileDetails?: { key: string; name: string; type: string } | null, providedPlanId?: string, isDirectModification?: boolean) => {
    const request = requestManager.prepareMessageSend(content, selectedItems, fileDetails, providedPlanId)
    if (!request) {
      return
    }

    const { planId, userMessage, thinkingMessage, abortController, requestKey } = request

    // Initialize accumulator and add message
    streamingHandlers.accumulatorRef.current.thinking.set(planId, '')
    streamingHandlers.accumulatorRef.current.description.set(planId, '')
    setHistory(prev => [...prev, userMessage])
    setMessages(prev => [...prev, userMessage, thinkingMessage])

    const [_, error] = await tryCatch(async () => {
      await updateHistoryMutation.mutateAsync({
        id: projectId,
        messages: options.sendDefaultThinkingMessage ? [userMessage, thinkingMessage] : [userMessage],
      })

      const iterable = await llmGenerate(
        projectId, content, planId, selectedItems, fileDetails || undefined, abortController,
        isDirectModification ? undefined : selectedModelId, isDirectModification
      )
      await responseProcessor.processAIResponse(iterable, planId)
    })
    
    if (error) {
      requestManager.handleSendError(error, planId, abortController, requestKey,
        streamingHandlers, stageTimersRef, progressRef)
    }
    
    requestManager.cleanupRequest(requestKey, abortController)
  }, [requestManager, responseProcessor, streamingHandlers, setHistory, setMessages,
     projectId, updateHistoryMutation, options.sendDefaultThinkingMessage, selectedModelId])

  // Send initial message to AI
  const sendInitialMessageToAI = useCallback(async (userMessage: UserMessageType,
    selectedItems: any[] = [], fileDetails?: { key: string; name: string; type: string } | null, providedPlanId?: string) => {

    if (isLoading) {
      return
    }

    const planId = providedPlanId || userMessage.planId || createId()

    // Auto-extract attachment from userMessage if fileDetails not provided
    const finalFileDetails = fileDetails || (userMessage as any)?.attachment || null

    const abortController = new AbortController()
    currentAbortControllerRef.current = abortController

    streamingHandlers.accumulatorRef.current.thinking.set(planId, '')
    streamingHandlers.accumulatorRef.current.description.set(planId, '')

    const content = userMessage.message
    const thinkingMessage: ThinkingMessageType = { type: 'thinking', content: '', planId }
    setMessages(prev => [...prev, thinkingMessage])
    progressManager.updateLoadingStage(planId, 'thinking', 0, progressRef, stageTimersRef)
    setIsLoading(true)

    const [_, error] = await tryCatch(async () => {
      
      const iterable = await llmGenerate(
        projectId, content, planId, selectedItems, finalFileDetails || undefined, abortController, selectedModelId
      )
      await responseProcessor.processAIResponse(iterable, planId)
    })

    if (error) {
      requestManager.handleSendError(error, planId, abortController, '',
        streamingHandlers, stageTimersRef, progressRef)
    }
    
    if (currentAbortControllerRef.current === abortController) {
      currentAbortControllerRef.current = null
    }
    setLoading(null)
  }, [isLoading, projectId, setMessages, setIsLoading, streamingHandlers,
     responseProcessor, requestManager, progressManager, setLoading, selectedModelId])

  const cleanup = useCallback(() => {
    if (currentAbortControllerRef.current?.signal.aborted === false) {
      currentAbortControllerRef.current.abort()
    }
    activeRequestsRef.current.clear()
    Object.values(stageTimersRef.current).forEach(clearInterval)
    stageTimersRef.current = {}
    progressRef.current = {}
  }, [projectId])

  return {
    sendMessageToAI, sendInitialMessageToAI, stopGeneration: requestManager.stopGeneration,
    isStopping, canStop: !!currentAbortControllerRef.current && !currentAbortControllerRef.current.signal.aborted,
    currentStage, stageProgress, animationConfig, progressState: progressRef.current,
    getActiveRequestsCount: () => activeRequestsRef.current.size,
    cleanup
  }
} 