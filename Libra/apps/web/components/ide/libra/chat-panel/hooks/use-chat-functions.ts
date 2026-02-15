/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-chat-functions.ts
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

import type { HistoryType } from '@libra/common'
import type { ChatFunctionOptions } from './types'
import { useChatState } from './use-chat-state'
import { useMessageHandler } from './use-message-handler'

/**
 * Custom Hook for chat functionality
 * This is the main entry point, integrating state management, message processing and file handling functionality
 */
export const useChatFunctions = (
  initialMessages: HistoryType,
  onFileContentUpdate?: (path: string, content: string) => void,
  options?: ChatFunctionOptions,
  deployChanges?: () => Promise<void>,
  selectedModelId?: string
) => {
  // Get state management
  const {
    fileDiffs,
    setFileDiffs,
    loading,
    setLoading,
    history,
    setHistory,
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    codeChanges,
    setCodeChanges,
    currentVersion,
    setCurrentVersion,
    feedback,
    setFeedback,
    mergedOptions,
  } = useChatState(initialMessages, options)

  // Initialize message processing
  const {
    sendMessageToAI,
    revertHistory,
    sendInitialMessageToAI,
    stopGeneration,
    isStopping,
    canStop,
  } = useMessageHandler(
    mergedOptions as Required<ChatFunctionOptions>,
    history,
    setHistory,
    messages,
    setMessages,
    setFileDiffs,
    setLoading,
    setIsLoading,
    isLoading,
    onFileContentUpdate,
    deployChanges,
    selectedModelId
  )

  return {
    messages,
    setMessages,
    isLoading,
    codeChanges,
    currentVersion,
    feedback,
    sendMessageToAI,
    sendInitialMessageToAI,
    stopGeneration,
    isStopping,
    canStop,
    loading,
    revertHistory,
    // Expose setMessages for external updates
    addMessage: (message: any) => {
      setMessages(prev => [...prev, message])
    },
  }
}
