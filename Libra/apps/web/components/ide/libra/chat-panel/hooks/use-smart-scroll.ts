/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-smart-scroll.ts
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

import { useCallback, useEffect, useRef, useState } from 'react'

// Scroll trigger types
type ScrollTriggerType =
  | 'user_message'     // User sends message
  | 'ai_start'        // AI starts replying
  | 'ai_streaming'    // AI streaming reply
  | 'ai_complete'     // AI reply complete
  | 'content_change'  // Content changed
  | 'manual'          // Manual scroll
  | 'tab_switch'      // Tab switch
  | 'initial_load'    // Initial load

interface SmartScrollState {
  isUserScrolling: boolean
  lastUserScrollTime: number
  isAtBottom: boolean
  autoScrollEnabled: boolean
  lastScrollPosition: number
  userInteractionDetected: boolean
}

interface SmartScrollOptions {
  scrollThreshold?: number        // Threshold for being near bottom
  userScrollTimeout?: number      // User scroll timeout duration
  autoScrollDelay?: number        // Auto scroll delay
  preservePositionOnTabSwitch?: boolean  // Preserve position on tab switch
}

interface UseSmartScrollReturn {
  // State
  isUserScrolling: boolean
  isAtBottom: boolean
  autoScrollEnabled: boolean
  
  // Methods
  scrollToBottom: (force?: boolean) => void
  scrollToBottomWithType: (triggerType: ScrollTriggerType) => void
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void
  enableAutoScroll: () => void
  disableAutoScroll: () => void
  preserveScrollPosition: () => number
  restoreScrollPosition: (position: number) => void
  
  // Internal state (for debugging)
  scrollState: SmartScrollState
}

/**
 * Smart scroll management Hook
 * 
 * Features:
 * 1. Track user scroll behavior
 * 2. Intelligently decide when to auto-scroll
 * 3. Preserve scroll position on tab switch
 * 4. Distinguish different types of scroll triggers
 */
export function useSmartScroll(
  scrollAreaRef: React.RefObject<HTMLDivElement | null>,
  options: SmartScrollOptions = {}
): UseSmartScrollReturn {
  
  const {
    scrollThreshold = 100,
    userScrollTimeout = 3000,
    autoScrollDelay = 150,
    preservePositionOnTabSwitch = true,
  } = options

  // Scroll state
  const [scrollState, setScrollState] = useState<SmartScrollState>({
    isUserScrolling: false,
    lastUserScrollTime: 0,
    isAtBottom: true,
    autoScrollEnabled: true,
    lastScrollPosition: 0,
    userInteractionDetected: false,
  })

  // Internal references
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingBySystemRef = useRef(false)
  const preservedPositionRef = useRef<number | null>(null)

  // Check if at bottom
  const checkIsAtBottom = useCallback((element: HTMLDivElement): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = element
    return scrollHeight - scrollTop - clientHeight < scrollThreshold
  }, [scrollThreshold])

  // Core implementation for scrolling to bottom
  const performScrollToBottom = useCallback(() => {
    const element = scrollAreaRef.current
    if (!element) return

    isScrollingBySystemRef.current = true
    
    requestAnimationFrame(() => {
      const targetPosition = element.scrollHeight - element.clientHeight
      element.scrollTop = targetPosition
      
      // Reset system scroll flag after brief delay
      setTimeout(() => {
        isScrollingBySystemRef.current = false
      }, 100)
    })
  }, [scrollAreaRef])

  // Smart scroll decision logic
  const shouldAutoScroll = useCallback((triggerType: ScrollTriggerType): boolean => {
    const { isUserScrolling, autoScrollEnabled, isAtBottom } = scrollState
    
    // Cases for forced scrolling
    if (triggerType === 'user_message' || triggerType === 'manual') {
      return true
    }
    
    // Don't scroll on tab switch if preserve position is set
    if (triggerType === 'tab_switch' && preservePositionOnTabSwitch) {
      return false
    }
    
    // Don't auto-scroll when user is scrolling
    if (isUserScrolling) {
      return false
    }
    
    // Don't scroll when auto-scroll is disabled
    if (!autoScrollEnabled) {
      return false
    }
    
    // For AI start or content change, only scroll if near bottom
    if (triggerType === 'ai_start' || triggerType === 'content_change') {
      return isAtBottom
    }
    
    // For AI complete, decide based on current position
    if (triggerType === 'ai_complete') {
      return isAtBottom
    }
    
    // Scroll to bottom on initial load
    if (triggerType === 'initial_load') {
      return true
    }
    
    return false
  }, [scrollState, preservePositionOnTabSwitch])

  // Public scroll method
  const scrollToBottom = useCallback((force: boolean = false) => {
    if (force) {
      performScrollToBottom()
      return
    }
    
    if (shouldAutoScroll('manual')) {
      performScrollToBottom()
    }
  }, [performScrollToBottom, shouldAutoScroll])

  // Typed scroll method
  const scrollToBottomWithType = useCallback((triggerType: ScrollTriggerType) => {
    if (shouldAutoScroll(triggerType)) {
      setTimeout(() => {
        performScrollToBottom()
      }, autoScrollDelay)
    }
  }, [shouldAutoScroll, performScrollToBottom, autoScrollDelay])

  // Handle scroll event
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    
    // Ignore if system-triggered scroll
    if (isScrollingBySystemRef.current) {
      return
    }

    const isAtBottom = checkIsAtBottom(element)
    const currentTime = Date.now()

    setScrollState(prev => ({
      ...prev,
      isUserScrolling: true,
      lastUserScrollTime: currentTime,
      isAtBottom,
      lastScrollPosition: element.scrollTop,
      userInteractionDetected: true,
      autoScrollEnabled: isAtBottom, // Re-enable auto-scroll when scrolled to bottom
    }))

    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // Set user scroll timeout
    scrollTimeoutRef.current = setTimeout(() => {
      setScrollState(prev => ({
        ...prev,
        isUserScrolling: false,
      }))
    }, userScrollTimeout)
  }, [checkIsAtBottom, userScrollTimeout])

  // Enable auto scroll
  const enableAutoScroll = useCallback(() => {
    setScrollState(prev => ({
      ...prev,
      autoScrollEnabled: true,
    }))
  }, [])

  // Disable auto scroll
  const disableAutoScroll = useCallback(() => {
    setScrollState(prev => ({
      ...prev,
      autoScrollEnabled: false,
    }))
  }, [])

  // Save scroll position
  const preserveScrollPosition = useCallback((): number => {
    const element = scrollAreaRef.current
    if (!element) return 0
    
    const position = element.scrollTop
    preservedPositionRef.current = position
    return position
  }, [scrollAreaRef])

  // Restore scroll position
  const restoreScrollPosition = useCallback((position: number) => {
    const element = scrollAreaRef.current
    if (!element) return
    
    isScrollingBySystemRef.current = true
    
    requestAnimationFrame(() => {
      element.scrollTop = position
      
      setTimeout(() => {
        isScrollingBySystemRef.current = false
      }, 100)
    })
  }, [scrollAreaRef])

  // Monitor scroll area changes, update bottom state
  useEffect(() => {
    const element = scrollAreaRef.current
    if (!element) return

    const observer = new ResizeObserver(() => {
      const isAtBottom = checkIsAtBottom(element)
      setScrollState(prev => ({
        ...prev,
        isAtBottom,
      }))
    })

    observer.observe(element)
    
    return () => {
      observer.disconnect()
    }
  }, [scrollAreaRef, checkIsAtBottom])

  // Clean up timers
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    isUserScrolling: scrollState.isUserScrolling,
    isAtBottom: scrollState.isAtBottom,
    autoScrollEnabled: scrollState.autoScrollEnabled,
    
    // Methods
    scrollToBottom,
    scrollToBottomWithType,
    handleScroll,
    enableAutoScroll,
    disableAutoScroll,
    preserveScrollPosition,
    restoreScrollPosition,
    
    // Debug state
    scrollState,
  }
} 