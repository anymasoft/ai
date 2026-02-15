/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-streaming-accumulator.ts
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

import type { HistoryType, MessageType, PlanMessageType, ThinkingMessageType, TimingMessageType } from '@libra/common'
import { tryCatch } from '@libra/common'
import type { UseMutationResult } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import type { DetailedLoadingStatus, StreamResponseType } from '../types'

/**
 * Update history mutation type definition
 * Uses any for error type to accommodate tRPC client error types
 */
type UpdateHistoryMutation = UseMutationResult<
  { success: boolean; historyLength: number },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  { id: string; messages: MessageType | MessageType[] },
  unknown
>

/**
 * Streaming message type based on StreamResponseType
 */
type StreamingMessage = StreamResponseType & {
  data?: {
    content?: string
    status?: string
    progress?: number
  }
}

/**
 * Streaming content accumulator interface
 */
interface StreamingAccumulator {
  thinking: Map<string, string> // planId -> accumulated thinking content
  description: Map<string, string> // planId -> accumulated description content
}

/**
 * Scroll trigger callback interface
 */
interface ScrollTriggerCallbacks {
  onContentUpdate?: (
    planId: string,
    contentType: 'thinking' | 'description',
    contentLength: number
  ) => void
  onStreamingStart?: (planId: string, contentType: 'thinking' | 'description') => void
  onStreamingComplete?: (planId: string, contentType: 'thinking' | 'description') => void
}

/**
 * Streaming content accumulator Hook
 */
export const useStreamingAccumulator = (
  setMessages: React.Dispatch<React.SetStateAction<HistoryType>>,
  setHistory: React.Dispatch<React.SetStateAction<HistoryType>>,
  setLoading: React.Dispatch<React.SetStateAction<DetailedLoadingStatus>>,
  updateHistoryMutation: UpdateHistoryMutation,
  projectId: string,
  scrollCallbacks?: ScrollTriggerCallbacks
) => {
  // Streaming content accumulator
  const accumulatorRef = useRef<StreamingAccumulator>({
    thinking: new Map(),
    description: new Map(),
  })

  /**
   * Clear accumulator data for specified planId
   */
  const clearAccumulatorForPlan = useCallback(
    (planId: string) => {
      accumulatorRef.current.thinking.delete(planId)
      accumulatorRef.current.description.delete(planId)
    },
    []
  )

  /**
   * Handle thinking messages - accumulate streaming content (for frontend display only)
   */
  const handleThinkingMessage = useCallback(
    async (message: StreamingMessage, planId: string) => {
      const thinkingFragment = message.data?.content
      if (!thinkingFragment) {
        return
      }

      // Validate message structure
      if (!message.data || typeof message.data !== 'object') {
        return
      }

      // Accumulate thinking content
      const currentThinking = accumulatorRef.current.thinking.get(planId) || ''
      const updatedThinking = currentThinking + thinkingFragment
      const isFirstFragment = currentThinking === ''

      accumulatorRef.current.thinking.set(planId, updatedThinking)

      // Trigger scroll callback
      if (isFirstFragment && scrollCallbacks?.onStreamingStart) {
        scrollCallbacks.onStreamingStart(planId, 'thinking')
      }

      if (scrollCallbacks?.onContentUpdate) {
        scrollCallbacks.onContentUpdate(planId, 'thinking', updatedThinking.length)
      }

      // Real-time update of thinking messages in UI
      const [_, error] = tryCatch(() => {
        setMessages((prev) => {
          const hasExistingThinking = prev.some(
            (msg) => msg.type === 'thinking' && msg.planId === planId
          )

          if (hasExistingThinking) {
            return prev.map((msg) => {
              if (msg.type === 'thinking' && msg.planId === planId) {
                return {
                  ...msg,
                  content: updatedThinking,
                  status: 'streaming', // Add streaming status marker
                } as ThinkingMessageType & { status?: string }
              }
              return msg
            })
          }

          // Create new thinking message (if it doesn't exist)
          const thinkingMessage: ThinkingMessageType = {
            type: 'thinking',
            content: updatedThinking,
            planId,
          }
          return [...prev, thinkingMessage]
        })
      })

      if (error) {
        // Error updating thinking message in UI
      }
    },
    [setMessages, scrollCallbacks]
  )

  /**
   * Handle description messages - accumulate streaming content (for frontend display only)
   */
  const handleDescriptionMessage = useCallback(
    async (message: StreamingMessage, planId: string) => {
      const descriptionFragment = message.data?.content
      if (!descriptionFragment) {
        return
      }

      // Validate message structure
      if (!message.data || typeof message.data !== 'object') {
        return
      }

      // Accumulate description content
      const currentDescription = accumulatorRef.current.description.get(planId) || ''
      const updatedDescription = currentDescription + descriptionFragment
      const isFirstFragment = currentDescription === ''

      accumulatorRef.current.description.set(planId, updatedDescription)

      // Trigger scroll callback
      if (isFirstFragment && scrollCallbacks?.onStreamingStart) {
        scrollCallbacks.onStreamingStart(planId, 'description')
      }

      if (scrollCallbacks?.onContentUpdate) {
        scrollCallbacks.onContentUpdate(planId, 'description', updatedDescription.length)
      }

      // Check if plan message already exists
      const [_, error] = tryCatch(() => {
        setMessages((prev) => {
          const existingPlanIndex = prev.findIndex(
            (msg) => msg.type === 'plan' && msg.planId === planId
          )

          if (existingPlanIndex >= 0) {
            // Update existing plan message
            return prev.map((msg, index) => {
              if (index === existingPlanIndex) {
                return {
                  ...msg,
                  content: updatedDescription,
                  status: 'streaming', // Add streaming status marker
                } as PlanMessageType & { status?: string }
              }
              return msg
            })
          }

          // Create new plan message
          const planMessage: PlanMessageType = {
            type: 'plan',
            content: updatedDescription,
            planId,
          }
          return [...prev, planMessage]
        })

        setLoading('actions_start')
      })

      if (error) {
        // Error updating description message in UI
      }
    },
    [setMessages, setLoading, scrollCallbacks]
  )

  /**
   * Handle complete thinking messages - save to database in one go
   */
  const handleThinkingCompleteMessage = useCallback(
    async (message: StreamingMessage, planId: string) => {
      const completeThinking = message.data?.content
      if (!completeThinking || !completeThinking.trim()) {
        return
      }

      // Trigger completion callback
      if (scrollCallbacks?.onStreamingComplete) {
        scrollCallbacks.onStreamingComplete(planId, 'thinking')
      }

      // Create thinking message
      const thinkingMessage: ThinkingMessageType = {
        type: 'thinking',
        content: completeThinking,
        planId,
      }

      // Create timing message for this planId (if it doesn't exist)
      const timingMessage: TimingMessageType = {
        type: 'timing',
        planId,
        timestamp: Date.now(),
      }

      // Update thinking message in UI
      setMessages((prev) => {
        const hasExistingThinking = prev.some((msg) => {
          const msgWithPlanId = msg as { planId?: string }
          return msg.type === 'thinking' && msgWithPlanId.planId === planId
        })
        const hasExistingTiming = prev.some((msg) => {
          const msgWithPlanId = msg as { planId?: string }
          return msg.type === 'timing' && msgWithPlanId.planId === planId
        })

        let updatedMessages = prev

        // Add timing message if it doesn't exist
        if (!hasExistingTiming) {
          // Find the position to insert timing message (before first message of this planId)
          const firstMessageIndex = prev.findIndex(msg => {
            const msgWithPlanId = msg as { planId?: string }
            return msgWithPlanId.planId === planId
          })

          if (firstMessageIndex >= 0) {
            // Insert timing message before the first message of this planId
            updatedMessages = [
              ...prev.slice(0, firstMessageIndex),
              timingMessage,
              ...prev.slice(firstMessageIndex)
            ]
          } else {
            // If no existing messages for this planId, add timing message at the end
            updatedMessages = [...prev, timingMessage]
          }
        }

        // Update or add thinking message
        if (hasExistingThinking) {
          return updatedMessages.map((msg) => {
            const msgWithPlanId = msg as { planId?: string }
            return msg.type === 'thinking' && msgWithPlanId.planId === planId
              ? ({ ...thinkingMessage, status: 'complete' } as ThinkingMessageType & {
                  status?: string
                })
              : msg
          })
        }

        return [
          ...updatedMessages,
          { ...thinkingMessage, status: 'complete' } as ThinkingMessageType & { status?: string },
        ]
      })

      // Save to history
      setHistory((prevHistory) => {
        const hasExistingThinking = prevHistory.some((msg) => {
          const msgWithPlanId = msg as { planId?: string }
          return msg.type === 'thinking' && msgWithPlanId.planId === planId
        })
        const hasExistingTiming = prevHistory.some((msg) => {
          const msgWithPlanId = msg as { planId?: string }
          return msg.type === 'timing' && msgWithPlanId.planId === planId
        })

        let updatedHistory = prevHistory

        // Add timing message if it doesn't exist
        if (!hasExistingTiming) {
          // Find the position to insert timing message (before first message of this planId)
          const firstMessageIndex = prevHistory.findIndex(msg => {
            const msgWithPlanId = msg as { planId?: string }
            return msgWithPlanId.planId === planId
          })

          if (firstMessageIndex >= 0) {
            // Insert timing message before the first message of this planId
            updatedHistory = [
              ...prevHistory.slice(0, firstMessageIndex),
              timingMessage,
              ...prevHistory.slice(firstMessageIndex)
            ]
          } else {
            // If no existing messages for this planId, add timing message at the end
            updatedHistory = [...prevHistory, timingMessage]
          }
        }

        // Update or add thinking message
        if (hasExistingThinking) {
          return updatedHistory.map((msg) => {
            const msgWithPlanId = msg as { planId?: string }
            return msg.type === 'thinking' && msgWithPlanId.planId === planId ? thinkingMessage : msg
          })
        }

        return [...updatedHistory, thinkingMessage]
      })

      // Save to server in one go (timing message first, then thinking message)
      const [_, error] = await tryCatch(async () => {
        await updateHistoryMutation.mutateAsync({
          id: projectId,
          messages: [timingMessage, thinkingMessage],
        })
      })

      if (error) {
        // Failed to save thinking complete message to server
      }
    },
    [setMessages, setHistory, updateHistoryMutation, projectId, scrollCallbacks]
  )

  /**
   * Handle complete description messages - save to database in one go
   */
  const handleDescriptionCompleteMessage = useCallback(
    async (message: StreamingMessage, planId: string) => {
      const completeDescription = message.data?.content
      if (!completeDescription || !completeDescription.trim()) {
        return
      }

      // Trigger completion callback
      if (scrollCallbacks?.onStreamingComplete) {
        scrollCallbacks.onStreamingComplete(planId, 'description')
      }

      // Create plan message
      const planMessage: PlanMessageType = {
        type: 'plan',
        content: completeDescription,
        planId,
      }

      // Update plan message in UI
      setMessages((prev) => {
        const existingPlanIndex = prev.findIndex(
          (msg) => msg.type === 'plan' && msg.planId === planId
        )

        if (existingPlanIndex >= 0) {
          return prev.map((msg, index) => {
            if (index === existingPlanIndex) {
              return { ...planMessage, status: 'complete' } as PlanMessageType & { status?: string }
            }
            return msg
          })
        }

        return [
          ...prev,
          { ...planMessage, status: 'complete' } as PlanMessageType & { status?: string },
        ]
      })

      setLoading('actions_start')

      // Save to history
      setHistory((prevHistory) => {
        const hasExistingPlan = prevHistory.some(
          (msg) => msg.type === 'plan' && msg.planId === planId
        )

        if (hasExistingPlan) {
          return prevHistory.map((msg) =>
            msg.type === 'plan' && msg.planId === planId ? planMessage : msg
          )
        }

        return [...prevHistory, planMessage]
      })

      // Save to server in one go
      const [_, error] = await tryCatch(async () => {
        await updateHistoryMutation.mutateAsync({
          id: projectId,
          messages: [planMessage],
        })
      })

      if (error) {
        // Failed to save description complete message to server
      }
    },
    [setMessages, setLoading, setHistory, updateHistoryMutation, projectId, scrollCallbacks]
  )

  return {
    clearAccumulatorForPlan,
    handleThinkingMessage,
    handleDescriptionMessage,
    handleThinkingCompleteMessage,
    handleDescriptionCompleteMessage,
    accumulatorRef,
  }
}
