/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * message-state-provider.tsx
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

import { createContext, useCallback, useContext, useMemo } from 'react'
import type { BaseMessage, CommandMessage, DiffMessage } from '../components/types/message-types'
import {
  type TabType,
  type UseMessageStateReturn,
  useMessageState,
} from '../hooks/use-message-state'

// Context interface definition
interface MessageStateContextValue extends UseMessageStateReturn {
  // Extension methods
  handleTabClick: (tabId: TabType) => void
  handleToggleExpanded: () => void
  updateFromMessages: (messages: BaseMessage[]) => void
}

// Create Context
const MessageStateContext = createContext<MessageStateContextValue | null>(null)

// Provider Props interface
interface MessageStateProviderProps {
  children: React.ReactNode
  messages: BaseMessage[]
  planId?: string
  isLastMessage?: boolean
  isLoading?: boolean
  onFileClick: (path: string) => void
  onRevert?: (planId: string) => void
}

/**
 * Message state provider component
 * Provides unified state management context, simplifying state access for child components
 */
export const MessageStateProvider = ({
  children,
  messages,
  planId,
  isLastMessage = true,
  isLoading = false,
  onFileClick: _onFileClick,
  onRevert: _onRevert,
}: MessageStateProviderProps) => {
  // Message classification logic
  const classifyMessages = useCallback((msgs: BaseMessage[]) => {
    let thinking: BaseMessage | undefined
    let plan: BaseMessage | undefined
    const commands: CommandMessage[] = []
    let diff: DiffMessage | undefined

    for (const message of msgs) {
      if (!message) continue

      // Classify based on message type or content characteristics
      if (
        message.type === 'thinking' ||
        (typeof message.content === 'string' && message.content.includes('[Thinking]'))
      ) {
        thinking = message
      } else if (
        message.type === 'plan' ||
        (typeof message.content === 'string' && message.content.includes('[Plan]'))
      ) {
        plan = message
      } else if (message.type === 'command') {
        commands.push(message as CommandMessage)
      } else if (message.type === 'diff') {
        diff = message as DiffMessage
      } else if (!thinking && !plan) {
        // If no explicit type, determine based on content length and characteristics
        const content = typeof message.content === 'string' ? message.content : ''
        if (content.length > 500 || content.includes('```')) {
          plan = message
        } else {
          thinking = message
        }
      }
    }

    return { thinking, plan, commands, diff }
  }, [])

  // Detect thinking in progress state
  const hasThinkingInProgress = useMemo(() => {
    if (!isLoading) return false

    const { thinking } = classifyMessages(messages)
    return (
      !thinking ||
      !thinking.content ||
      (typeof thinking.content === 'string' && thinking.content.trim() === '')
    )
  }, [isLoading, messages, classifyMessages])

  // Classify messages
  const classifiedMessages = useMemo(() => classifyMessages(messages), [messages, classifyMessages])

  // Prepare messages for useMessageState (filter undefined values)
  const messageStateInput = useMemo(() => {
    const input: {
      thinking?: BaseMessage
      plan?: BaseMessage
      commands?: CommandMessage[]
      diff?: DiffMessage
    } = {}

    if (classifiedMessages.thinking) {
      input.thinking = classifiedMessages.thinking
    }
    if (classifiedMessages.plan) {
      input.plan = classifiedMessages.plan
    }
    if (classifiedMessages.commands.length > 0) {
      input.commands = classifiedMessages.commands
    }
    if (classifiedMessages.diff) {
      input.diff = classifiedMessages.diff
    }

    return input
  }, [classifiedMessages])

  // Prepare options for useMessageState (filter undefined values)
  const messageStateOptions = useMemo(() => {
    const options: {
      planId?: string
      isLastMessage?: boolean
      isLoading?: boolean
      hasThinkingInProgress?: boolean
    } = {
      isLastMessage,
      isLoading,
      hasThinkingInProgress,
    }

    if (planId) {
      options.planId = planId
    }

    return options
  }, [planId, isLastMessage, isLoading, hasThinkingInProgress])

  // Use state management Hook
  const messageState = useMessageState(messageStateInput, messageStateOptions)

  // Extension methods
  const handleTabClick = useCallback(
    (tabId: TabType) => {
      messageState.setActiveTab(tabId)
    },
    [messageState]
  )

  const handleToggleExpanded = useCallback(() => {
    messageState.toggleExpanded()
  }, [messageState])

  const updateFromMessages = useCallback(
    (msgs: BaseMessage[]) => {
      const classified = classifyMessages(msgs)

      // Prepare messages for updateMessages (filter undefined values)
      const updateInput: {
        thinking?: BaseMessage
        plan?: BaseMessage
        commands?: CommandMessage[]
        diff?: DiffMessage
      } = {}

      if (classified.thinking) {
        updateInput.thinking = classified.thinking
      }
      if (classified.plan) {
        updateInput.plan = classified.plan
      }
      if (classified.commands.length > 0) {
        updateInput.commands = classified.commands
      }
      if (classified.diff) {
        updateInput.diff = classified.diff
      }

      messageState.updateMessages(updateInput)
    },
    [classifyMessages, messageState]
  )

  // Context value
  const contextValue = useMemo<MessageStateContextValue>(
    () => ({
      ...messageState,
      handleTabClick,
      handleToggleExpanded,
      updateFromMessages,
    }),
    [messageState, handleTabClick, handleToggleExpanded, updateFromMessages]
  )

  return (
    <MessageStateContext.Provider value={contextValue}>{children}</MessageStateContext.Provider>
  )
}

/**
 * Hook for using message state
 * Provides type-safe Context access
 */
export const useMessageStateContext = (): MessageStateContextValue => {
  const context = useContext(MessageStateContext)

  if (!context) {
    throw new Error('useMessageStateContext must be used within a MessageStateProvider')
  }

  return context
}

// Export types
export type { MessageStateContextValue }
