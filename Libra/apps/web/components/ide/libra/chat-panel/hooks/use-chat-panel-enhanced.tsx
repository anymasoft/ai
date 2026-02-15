/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-chat-panel-enhanced.tsx
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

import { tryCatch } from '@libra/common'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MessageGroup } from '../types'
import { useSmartScroll } from './use-smart-scroll'

// Scroll trigger type enumeration
type ScrollTriggerType =
  | 'user_message'
  | 'ai_start'
  | 'ai_streaming'
  | 'ai_complete'
  | 'content_change'

// Message type definition
interface Message {
  type: string
  content?: string | object
  planId?: string
}

interface UseChatPanelParams {
  messages: Message[]
  onFileClick: (filePath: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  adjustTextareaHeight: () => void
  onScrollTrigger?: (triggerType: ScrollTriggerType) => void
}

interface UseChatPanelReturn {
  // State
  message: string
  isSending: boolean
  autoScrollEnabled: boolean
  hasNewMessages: boolean
  unreadCount: number

  // Handler functions
  setMessage: (message: string) => void
  setIsSending: (isSending: boolean) => void
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void
  scrollToBottom: () => void
  scrollToBottomWithType: (triggerType: ScrollTriggerType) => void
  handleScrollToBottomClick: () => void
  groupedMessages: MessageGroup[]
}

/**
 * Enhanced chat panel hook with smart scroll system
 */
export function useChatPanelEnhanced({
  messages,
  onFileClick: _onFileClick,
  textareaRef: _textareaRef,
  scrollAreaRef,
  messagesEndRef,
  adjustTextareaHeight,
  onScrollTrigger,
}: UseChatPanelParams): UseChatPanelReturn {
  // Basic state
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Initialize smart scroll system
  const smartScroll = useSmartScroll(scrollAreaRef, {
    scrollThreshold: 100,
    userScrollTimeout: 3000,
    autoScrollDelay: 150,
    preservePositionOnTabSwitch: true,
  })

  // New message state
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const lastMessageCountRef = useRef(0)

  // Message content hash detection - used to detect message depth changes
  const messagesContentHash = useMemo(() => {
    // Safety check: ensure messages is a valid array
    if (!messages || !Array.isArray(messages)) {
      return ''
    }

    return messages
      .map((msg) => {
        // Safety check: ensure msg exists
        if (!msg) {
          return 'empty-message'
        }

        // Safe handling of message content
        let contentStr = ''
        if (typeof msg.content === 'string') {
          contentStr = msg.content
        } else if (msg.content !== undefined && msg.content !== null) {
          const [jsonStr, error] = tryCatch(() => JSON.stringify(msg.content))
          if (error) {
            contentStr = '[invalid-content]'
          } else {
            contentStr = jsonStr || ''
          }
        }

        // Ensure all string operations are performed on valid strings
        const safeContentStr = contentStr || ''
        const msgType = msg.type || 'unknown'
        const planId = msg.planId || 'no-plan'

        return `${msgType}-${planId}-${safeContentStr.length}-${safeContentStr.slice(0, 50)}`
      })
      .join('|')
  }, [messages])

  // Previous message hash, used to detect changes
  const lastContentHashRef = useRef('')

  // Handle textarea changes
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value)
      // Auto-adjust height when input content changes
      adjustTextareaHeight()
    },
    [adjustTextareaHeight]
  )

  // Handle scroll events using smart scroll system
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    smartScroll.handleScroll(event)
  }, [smartScroll])

  // Scrolling functions using smart scroll
  const scrollToBottomWithType = useCallback(
    (triggerType: ScrollTriggerType) => {
      // Notify parent component of scroll event
      onScrollTrigger?.(triggerType)
      
      // Use smart scroll system
      smartScroll.scrollToBottomWithType(triggerType)
    },
    [smartScroll, onScrollTrigger]
  )

  // Keep original scrollToBottom function for compatibility
  const scrollToBottom = useCallback(() => {
    smartScroll.scrollToBottom()
  }, [smartScroll])

  // Group messages by planId
  const groupedMessages = useMemo(() => {
    const result: MessageGroup[] = []

    // Iterate through all messages for grouping
    for (const message of messages) {
      // Skip timing messages - they are used for timestamp extraction but not displayed
      if (message.type === 'timing') {
        continue
      }

      // Handle user messages separately
      if (message.type === 'user') {
        result.push({ type: 'user', messages: [message] })
        continue
      }

      // AI messages not belonging to any plan are displayed separately
      const planId = message.planId || 'no-plan-id'

      // Find existing group
      const existingGroupIndex = result.findIndex((g) => g.type === 'ai' && g.planId === planId)

      if (existingGroupIndex >= 0 && result[existingGroupIndex]) {
        // Add message to existing group
        result[existingGroupIndex].messages.push(message)
      } else {
        // Create new group
        result.push({
          type: 'ai',
          planId,
          messages: [message],
        })
      }
    }

    return result
  }, [messages])

  // Handle new message button click
  const handleScrollToBottomClick = useCallback(() => {
    // Enable auto-scroll and clear new message indicators
    smartScroll.enableAutoScroll()
    setHasNewMessages(false)
    setUnreadCount(0)
    lastMessageCountRef.current = messages.length

    // Force scroll to bottom
    smartScroll.scrollToBottom(true)
  }, [messages.length, smartScroll])

  // Trigger scroll when message content hash changes
  useEffect(() => {
    if (lastContentHashRef.current && lastContentHashRef.current !== messagesContentHash) {
      scrollToBottomWithType('content_change')
    }
    lastContentHashRef.current = messagesContentHash
  }, [messagesContentHash, scrollToBottomWithType])

  // Scroll handling when message count changes
  useEffect(() => {
    const currentMessageCount = messages.length
    const lastCount = lastMessageCountRef.current

    if (currentMessageCount > lastCount) {
      // New messages added
      const newMessages = messages.slice(lastCount)
      const hasUserMessage = newMessages.some((msg) => msg.type === 'user')
      const hasAIMessage = newMessages.some((msg) => msg.type !== 'user')

      if (hasUserMessage) {
        scrollToBottomWithType('user_message')
      } else if (hasAIMessage) {
        scrollToBottomWithType('ai_start')
      }
    }
  }, [messages.length, messages, scrollToBottomWithType])

  // Manage new message indicators based on smart scroll state
  useEffect(() => {
    const { autoScrollEnabled } = smartScroll.scrollState
    
    // If auto-scroll is disabled and there are new messages
    if (messages.length > 0 && !autoScrollEnabled) {
      // Calculate unread message count
      const newUnreadCount = messages.length - lastMessageCountRef.current
      if (newUnreadCount > 0) {
        setHasNewMessages(true)
        setUnreadCount(newUnreadCount)
      }
    } else if (autoScrollEnabled) {
      // User has scrolled to bottom, reset unread state and update read message count
      setHasNewMessages(false)
      setUnreadCount(0)
      lastMessageCountRef.current = messages.length
    }
  }, [messages, smartScroll.scrollState])

  return {
    // State
    message,
    isSending,
    autoScrollEnabled: smartScroll.autoScrollEnabled,
    hasNewMessages,
    unreadCount,

    // Handler functions
    setMessage,
    setIsSending,
    handleTextareaChange,
    handleScroll,
    scrollToBottom,
    scrollToBottomWithType,
    handleScrollToBottomClick,
    groupedMessages,
  }
} 