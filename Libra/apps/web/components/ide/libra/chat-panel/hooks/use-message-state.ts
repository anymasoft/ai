/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-message-state.ts
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

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { BaseMessage, CommandMessage, DiffMessage } from '../components/types/message-types'

// Tab type definition
export type TabType = 'thinking' | 'plan' | 'commands' | 'files' | 'none'

// Message state interface
interface MessageState {
  // Basic state
  activeTab: TabType
  isExpanded: boolean
  contentHeight: number

  // Message data
  thinking?: BaseMessage
  plan?: BaseMessage
  commands: CommandMessage[]
  diff?: DiffMessage

  // Loading state
  isLoading: boolean
  hasThinkingInProgress: boolean

  // Metadata
  planId?: string
  isLastMessage: boolean
}

// State update methods interface
interface MessageStateActions {
  setActiveTab: (tab: TabType) => void
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  setContentHeight: (height: number) => void
  updateMessages: (messages: {
    thinking?: BaseMessage
    plan?: BaseMessage
    commands?: CommandMessage[]
    diff?: DiffMessage
  }) => void
  setLoadingState: (isLoading: boolean, hasThinkingInProgress?: boolean) => void
}

// Complete Hook return type
export interface UseMessageStateReturn extends MessageState, MessageStateActions {}

/**
 * Unified message state management Hook
 * Centrally manages all message-related state and operations
 */
export const useMessageState = (
  initialMessages: {
    thinking?: BaseMessage
    plan?: BaseMessage
    commands?: CommandMessage[]
    diff?: DiffMessage
  } = {},
  options: {
    planId?: string
    isLastMessage?: boolean
    isLoading?: boolean
    hasThinkingInProgress?: boolean
  } = {}
): UseMessageStateReturn => {
  // Basic state
  const [activeTab, setActiveTabState] = useState<TabType>('none')
  const [isExpanded, setIsExpanded] = useState(true)
  const [contentHeight, setContentHeight] = useState(300)

  // Message data state
  const [thinking, setThinking] = useState<BaseMessage | undefined>(initialMessages.thinking)
  const [plan, setPlan] = useState<BaseMessage | undefined>(initialMessages.plan)
  const [commands, setCommands] = useState<CommandMessage[]>(initialMessages.commands || [])
  const [diff, setDiff] = useState<DiffMessage | undefined>(initialMessages.diff)

  // Loading state
  const [isLoading, setIsLoading] = useState(options.isLoading || false)
  const [hasThinkingInProgress, setHasThinkingInProgress] = useState(options.hasThinkingInProgress || false)

  // Metadata
  const planId = options.planId
  const isLastMessage = options.isLastMessage || true

  // Calculate available tabs
  const availableTabs = useMemo(() => {
    const tabs: TabType[] = []

    // Add tabs by priority
    if (thinking || hasThinkingInProgress) {
      tabs.push('thinking')
    }

    if (plan) {
      tabs.push('plan')
    }

    if (commands.length > 0) {
      tabs.push('commands')
    }

    if (diff?.diff?.length) {
      tabs.push('files')
    }

    return tabs
  }, [thinking, plan, commands, diff, hasThinkingInProgress])

  // Auto-select initial tab
  useEffect(() => {
    if (availableTabs.length > 0 && activeTab === 'none') {
      // Prioritize thinking tab (especially during loading state)
      if (availableTabs.includes('thinking')) {
        setActiveTabState('thinking')
      } else if (availableTabs.includes('plan')) {
        setActiveTabState('plan')
      } else if (availableTabs[0]) {
        setActiveTabState(availableTabs[0])
      }

      // Expand content by default
      setIsExpanded(true)
    }
  }, [availableTabs, activeTab])

  // State update methods
  const setActiveTab = useCallback((tab: TabType) => {
    if (availableTabs.includes(tab)) {
      setActiveTabState(tab)
      // Auto-expand content when switching tabs
      setIsExpanded(true)
    }
  }, [availableTabs])

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded)
  }, [])

  const updateMessages = useCallback((messages: {
    thinking?: BaseMessage
    plan?: BaseMessage
    commands?: CommandMessage[]
    diff?: DiffMessage
  }) => {
    if (messages.thinking !== undefined) {
      setThinking(messages.thinking)
    }
    if (messages.plan !== undefined) {
      setPlan(messages.plan)
    }
    if (messages.commands !== undefined) {
      setCommands(messages.commands)
    }
    if (messages.diff !== undefined) {
      setDiff(messages.diff)
    }
  }, [])

  const setLoadingState = useCallback((loading: boolean, thinkingInProgress?: boolean) => {
    setIsLoading(loading)
    if (thinkingInProgress !== undefined) {
      setHasThinkingInProgress(thinkingInProgress)
    }
  }, [])

  // Return complete state and methods
  return {
    // State
    activeTab,
    isExpanded,
    contentHeight,
    thinking,
    plan,
    commands,
    diff,
    isLoading,
    hasThinkingInProgress,
    planId,
    isLastMessage,
    
    // Methods
    setActiveTab,
    toggleExpanded,
    setExpanded,
    setContentHeight,
    updateMessages,
    setLoadingState
  }
} 