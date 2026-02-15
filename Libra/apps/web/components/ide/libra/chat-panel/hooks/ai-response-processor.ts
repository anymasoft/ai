/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * ai-response-processor.ts
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

import type { FileType, HistoryType } from '@libra/common'
import { tryCatch } from '@libra/common'
import type { Message } from './types'
import type { DetailedLoadingStatus } from '../types'
import { playNotificationSound } from '../utils'
import { toast } from 'sonner'

/**
 * AI response processor
 */
export const createResponseProcessor = (
  streamingHandlers: {
    handleThinkingMessage: (message: any, planId: string) => Promise<void>
    handleThinkingCompleteMessage: (message: any, planId: string) => Promise<void>
    handleDescriptionMessage: (message: any, planId: string) => Promise<void>
    handleDescriptionCompleteMessage: (message: any, planId: string) => Promise<void>
    clearAccumulatorForPlan: (planId: string) => void
  },
  messageProcessors: {
    handleCommandMessage: (message: any, planId: string) => Promise<void>
    handleFileUpdates: (fileUpdates: FileType[], planId: string) => Promise<void>
  },
  updateHandlers: {
    updateLoadingStage: (planId: string, stage: string, progress: number) => void
    setLoading: (status: DetailedLoadingStatus) => void
    setIsLoading: (isLoading: boolean) => void
    setMessages: React.Dispatch<React.SetStateAction<HistoryType>>
  },
  projectId: string,
  updateHistoryMutation: any,
  abortSignalRef: React.MutableRefObject<AbortController | null>,
  progressRefs: {
    progressRef: React.MutableRefObject<Record<string, any>>,
    stageTimersRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>
  },
  onFileContentUpdate?: (path: string, content: string) => void,
  deployChanges?: () => Promise<void>
) => {
  // Handle AI response
  const processAIResponse = async (iterable: AsyncIterable<any>, planId: string) => {
    const fileUpdates: FileType[] = []
    const { updateLoadingStage, setLoading, setIsLoading, setMessages } = updateHandlers
    const { progressRef, stageTimersRef } = progressRefs

    const [, error] = await tryCatch(async () => {
      for await (const message of iterable) {
        if (abortSignalRef.current?.signal.aborted) break

        if (message.type === 'thinking') {
          updateLoadingStage(planId, 'thinking', 20)
          await streamingHandlers.handleThinkingMessage(message, planId)
        } else if (message.type === 'thinking_complete') {
          updateLoadingStage(planId, 'thinking', 100)
          await streamingHandlers.handleThinkingCompleteMessage(message, planId)
          updateLoadingStage(planId, 'description', 0)
        } else if (message.type === 'description') {
          updateLoadingStage(planId, 'description', 30)
          await streamingHandlers.handleDescriptionMessage(message, planId)
        } else if (message.type === 'description_complete') {
          updateLoadingStage(planId, 'description', 100)
          await streamingHandlers.handleDescriptionCompleteMessage(message, planId)
          updateLoadingStage(planId, 'actions', 0)
        } else if (message.type === 'action') {
          updateLoadingStage(planId, 'actions', 50)
          if (message.data?.type === 'command') {
            // TODO fix
            await messageProcessors.handleCommandMessage(message, planId)
          } else if (message.data?.type === 'file') {
            fileUpdates.push(message.data)
            await messageProcessors.handleFileUpdates([message.data], planId)

            if (onFileContentUpdate && typeof onFileContentUpdate === 'function') {
              onFileContentUpdate(message.data.path, message.data.modified)
            }
          }
        }
      }

      updateLoadingStage(planId, 'complete', 100)
      playNotificationSound();
      setIsLoading(false);

      if (fileUpdates.length > 0) {
        const currentMessages = await new Promise<HistoryType>((resolve) => {
          setMessages((prev) => {
            resolve(prev)
            return prev
          })
        })

        const diffMessage = currentMessages.find(
          (msg) => msg.type === 'diff' && msg.planId === planId
        )

        if (diffMessage) {
          await updateHistoryMutation.mutateAsync({
            id: projectId,
            messages: [diffMessage],
          })

          if (deployChanges) {
            const [, deployError] = await tryCatch(async () => {
              await deployChanges()
            })

            if (deployError) {
              console.error('[Chat Panel] Failed to deploy project changes:', deployError)
            }
          }
        }
      }

      // Cleanup
      streamingHandlers.clearAccumulatorForPlan(planId)
      if (stageTimersRef.current[planId]) {
        clearInterval(stageTimersRef.current[planId])
        delete stageTimersRef.current[planId]
      }
      delete progressRef.current[planId]
    })

    if (error) {
      console.error('[Chat Panel] AI response error:', error)

      // Error cleanup
      streamingHandlers.clearAccumulatorForPlan(planId)
      if (stageTimersRef.current[planId]) {
        clearInterval(stageTimersRef.current[planId])
        delete stageTimersRef.current[planId]
      }

      // Set error state
      setLoading('error')
      setIsLoading(false)

      // Determine error type and show appropriate toast notification
      let toastMessage = 'An error occurred while processing your request, please try again later.'
      let chatMessage = 'An error occurred while processing your request, please try again later.'

      if ((error as any)?.type === 'QUOTA_EXCEEDED') {
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
      } else if ((error as any)?.type === 'UNAUTHORIZED') {
        toastMessage = 'Please log in to continue'
        chatMessage = 'Please log in to continue'
        toast.error(toastMessage)
      } else if ((error as any)?.type === 'FORBIDDEN') {
        toastMessage = 'Access denied. Please check your permissions.'
        chatMessage = 'Access denied. Please check your permissions.'
        toast.error(toastMessage)
      } else {
        // For unknown errors, show the specific error message if available
        const specificMessage = (error as any)?.message || (error as any)?.details || toastMessage
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
    }
  }

  return {
    processAIResponse
  }
} 