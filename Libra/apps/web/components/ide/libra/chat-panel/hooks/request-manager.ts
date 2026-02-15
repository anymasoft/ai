/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * request-manager.ts
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

import type { HistoryType, ThinkingMessageType, UserMessageType } from '@libra/common'
import { createId } from '@paralleldrive/cuid2'
import type { Message } from './types'
import type { DetailedLoadingStatus } from '../types'
import { toast } from 'sonner'

/**
 * Create request manager
 */
export const createRequestManager = (
  projectId: string,
  isLoading: boolean,
  setIsLoading: (value: boolean) => void,
  setLoading: (status: DetailedLoadingStatus) => void,
  setMessages: React.Dispatch<React.SetStateAction<HistoryType>>,
  setHistory: React.Dispatch<React.SetStateAction<HistoryType>>,
  updateLoadingStage: (planId: string, stage: string, progress: number) => void,
  activeRequestsRef: React.MutableRefObject<Set<string>>,
  initialRequestTrackerRef: React.MutableRefObject<{
    lastContent: string | null,
    lastTimestamp: number,
    isProcessing: boolean
  }>,
  currentAbortControllerRef: React.MutableRefObject<AbortController | null>,
  setIsStopping: (value: boolean) => void
) => {
  /**
   * Stop current AI generation
   */
  const stopGeneration = () => {
    if (currentAbortControllerRef.current && !currentAbortControllerRef.current.signal.aborted) {
      setIsStopping(true)
      currentAbortControllerRef.current.abort()
      
      // Immediately clean up state
      setLoading(null)
      setIsLoading(false)
      
      // Add stop message to UI
      setMessages((prev) => {
        const newMessages = [...prev]
        for (let i = newMessages.length - 1; i >= 0; i--) {
          const msg = newMessages[i]
          if (msg && (msg.type === 'thinking' || msg.type === 'plan')) {
            if ('content' in msg && typeof msg.content === 'string') {
              newMessages[i] = {
                ...msg,
                content: msg.content + '\n\n[Generation stopped by user]',
                status: 'stopped'
              } as any
            }
            break
          }
        }
        return newMessages
      })
      
      setTimeout(() => {
        setIsStopping(false)
        currentAbortControllerRef.current = null
      }, 500)
    }
  }

  /**
   * Prepare to send new message
   */
  const prepareMessageSend = (
    content: string,
    selectedItems: any[] = [],
    fileDetails?: { key: string; name: string; type: string } | null,
    providedPlanId?: string
  ) => {
    // Check basic conditions
    if (isLoading) return null
    if (!projectId) {
      toast.error('Cannot send message: Project ID does not exist')
      return null
    }
    if (!content.trim() && !fileDetails) return null

    const planId = providedPlanId || createId()
    const currentTime = Date.now()
    
    // Request unique identifier
    const requestKey = `${content}_${planId}_${currentTime}`
    
    // Check for duplicate requests
    if (activeRequestsRef.current.has(requestKey)) return null
    
    // Mark as active request
    activeRequestsRef.current.add(requestKey)
    
    // Create abort controller
    const abortController = new AbortController()
    currentAbortControllerRef.current = abortController
    
    // Create user message
    const userMessage = {
      type: 'user',
      message: content,
      planId,
      selectedElements: selectedItems.length > 0 ? selectedItems : undefined,
      attachment: fileDetails ? {
        key: fileDetails.key,
        name: fileDetails.name,
        type: fileDetails.type,
      } : undefined,
    } as UserMessageType

    // Create thinking message
    const thinkingMessage: ThinkingMessageType = {
      type: 'thinking',
      content: '',
      planId,
    }
    
    // Start thinking phase
    updateLoadingStage(planId, 'thinking', 0)
    setIsLoading(true)

    return {
      planId,
      userMessage,
      thinkingMessage,
      abortController,
      requestKey
    }
  }

  /**
   * Handle send error
   */
  const handleSendError = (
    error: any,
    planId: string,
    abortController: AbortController,
    requestKey: string,
    streamingHandlers: {
      clearAccumulatorForPlan: (planId: string) => void
    },
    stageTimersRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>,
    progressRef: React.MutableRefObject<Record<string, any>>
  ) => {
    // Check if user actively stopped
    if ((error as any)?.name === 'AbortError' || abortController.signal.aborted) {
      return null // Normal exit, don't show error
    }

    // AI response error

    // Error cleanup
    streamingHandlers.clearAccumulatorForPlan(planId)
    if (stageTimersRef.current[planId]) {
      clearInterval(stageTimersRef.current[planId])
      delete stageTimersRef.current[planId]
    }

    // Set error state and stop loading
    setLoading('error')
    setIsLoading(false)

    // Determine error type and show appropriate toast notification
    let toastMessage = 'An error occurred while processing your request, please try again later.'
    let chatMessage = 'An error occurred while processing your request, please try again later.'

    if (error?.type === 'QUOTA_EXCEEDED') {
      toastMessage = 'AI quota exhausted'
      chatMessage = 'AI quota exhausted'

      // Show toast with upgrade option for quota exceeded
      toast.error(toastMessage, {
        description: 'You have reached the AI usage limit. Please upgrade your plan or wait for the next billing cycle.',
        action: {
          label: 'Upgrade Plan',
          onClick: () => {
            // Navigate to pricing page or billing portal
            window.open('/#price', '_blank')
          }
        },
        duration: 8000,
      })
    } else if (error?.type === 'UNAUTHORIZED') {
      toastMessage = 'Please log in to continue'
      chatMessage = 'Please log in to continue'
      toast.error(toastMessage)
    } else if (error?.type === 'FORBIDDEN') {
      toastMessage = 'Access denied. Please check your permissions.'
      chatMessage = 'Access denied. Please check your permissions.'
      toast.error(toastMessage)
    } else {
      // For unknown errors, show the specific error message if available
      const specificMessage = error?.message || error?.details || toastMessage
      toast.error(specificMessage)
      chatMessage = specificMessage
    }

    // Add error message to chat interface
    const errorMessage: Message = {
      type: 'plan',
      content: chatMessage,
      planId,
      status: 'error',
    } as Message

    setMessages((prev) => {
      const filtered = prev.filter((msg) => !(msg.type === 'thinking' && msg.planId === planId))
      return [...filtered, errorMessage as any]
    })

    return errorMessage
  }

  /**
   * Clean up request
   */
  const cleanupRequest = (
    requestKey: string,
    abortController: AbortController
  ) => {
    activeRequestsRef.current.delete(requestKey)
    if (currentAbortControllerRef.current === abortController) {
      currentAbortControllerRef.current = null
    }
    setLoading(null)
    setIsLoading(false)
  }

  return {
    stopGeneration,
    prepareMessageSend,
    handleSendError,
    cleanupRequest
  }
} 