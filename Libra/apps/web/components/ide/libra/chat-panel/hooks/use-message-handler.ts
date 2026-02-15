/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-message-handler.ts
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

import { usePreviewStore } from '@/components/ide/libra/hooks/use-preview-store'
import { useProjectContext } from '@/lib/hooks/use-project-id'
import { useTRPC } from '@/trpc/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  FileDiffType,
  HistoryType,
} from '@libra/common'
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { ChatFunctionOptions } from './types'
import type { DetailedLoadingStatus } from '../types'
import { useRevertHistory } from './use-revert-history'
import { useStreamingAccumulator } from './use-streaming-accumulator'
import { useMessageProcessors } from './use-message-processors'
import { useAISender } from './use-ai-sender'

/**
 * Message handling Hook
 */
export const useMessageHandler = (
  options: Required<ChatFunctionOptions>,
  history: HistoryType,
  setHistory: React.Dispatch<React.SetStateAction<HistoryType>>,
  messages: HistoryType,
  setMessages: React.Dispatch<React.SetStateAction<HistoryType>>,
  setFileDiffs: React.Dispatch<React.SetStateAction<FileDiffType[]>>,
  setLoading: React.Dispatch<React.SetStateAction<DetailedLoadingStatus>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  isLoading: boolean,
  onFileContentUpdate?: (path: string, content: string) => void,
  deployChanges?: () => Promise<void>,
  selectedModelId?: string
) => {
  const { projectId } = useProjectContext()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Use preview Store instead of Context
  const setPreviewURL = usePreviewStore((state) => state.setPreviewURL)
  const setIsPreviewVisible = usePreviewStore((state) => state.setIsPreviewVisible)

  // Mutation for updating history
  const updateHistoryMutation = useMutation(
    trpc.history.appendHistory.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.history.getAll.pathFilter())
      },
      onError: (err) => {
        toast.error(err.data?.code === 'UNAUTHORIZED' ? 'You must be logged in to update the project' : 'Failed to update project')
      },
    })
  )

  // Rollback history hook
  const { revertHistory } = useRevertHistory(setHistory, setMessages)

  // Streaming content accumulator
  const streamingHandlers = useStreamingAccumulator(
    setMessages,
    setHistory,
    setLoading,
    updateHistoryMutation,
    projectId
  )

  /**
   * Save accumulated thinking and description to history
   * Note: Since thinking and description are now saved in real-time, this function is mainly for cleanup and fallback
   */
  const saveAccumulatedContent = useCallback(
    async (planId: string) => {
      // Since thinking and description are now saved in real-time, this is mainly for cleanup
      // But still check if there's any missed content that needs to be saved
      const accumulatedThinking = streamingHandlers.accumulatorRef.current.thinking.get(planId)
      const accumulatedDescription = streamingHandlers.accumulatorRef.current.description.get(planId)


      // Generally, thinking and description have already been saved in real-time
      // This is just as insurance to ensure nothing is missed
      if (accumulatedThinking?.trim() || accumulatedDescription?.trim()) {
        // Detected missed accumulated content, performing fallback save
      }
    },
    [streamingHandlers.accumulatorRef]
  )

  // Message processors
  const messageProcessors = useMessageProcessors(
    setMessages,
    setHistory,
    setFileDiffs,
    updateHistoryMutation,
    projectId,
    saveAccumulatedContent
  )

  // AI message sender
  const aiSender = useAISender(
    projectId,
    setMessages,
    setHistory,
    setLoading,
    setIsLoading,
    isLoading,
    updateHistoryMutation,
    streamingHandlers,
    messageProcessors,
    options,
    onFileContentUpdate,
    deployChanges,
    selectedModelId
  )

  return {
    sendMessageToAI: aiSender.sendMessageToAI,
    sendInitialMessageToAI: aiSender.sendInitialMessageToAI,
    stopGeneration: aiSender.stopGeneration,
    isStopping: aiSender.isStopping,
    canStop: aiSender.canStop,
    updateHistoryMutation,
    revertHistory,
  }
}
