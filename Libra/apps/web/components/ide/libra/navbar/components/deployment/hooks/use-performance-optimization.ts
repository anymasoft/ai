/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-performance-optimization.ts
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

import type { DependencyList } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Debounced value hook for performance optimization
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Throttled callback hook for performance optimization
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())
  const callbackRef = useRef(callback)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    ((...args) => {
      if (Date.now() - lastRun.current >= delay) {
        callbackRef.current(...args)
        lastRun.current = Date.now()
      }
    }) as T,
    []
  )
}

/**
 * Memoized localization hook to prevent unnecessary re-renders
 */
export function useMemoizedMessages(messageKeys: string[]) {
  return useMemo(() => {
    const messages: Record<string, string> = {}

    // Dynamically import messages to avoid circular dependencies
    // cspell:disable-next-line
    const m = require('@/paraglide/messages')

    messageKeys.forEach(key => {
      try {
        messages[key] = m[key]?.() || key
      } catch {
        messages[key] = key
      }
    })

    return messages
  }, [messageKeys])
}

/**
 * Optimized i18n message hook with caching
 */
export function useOptimizedI18n() {
  const messageCache = useRef<Map<string, string>>(new Map())

  const getMessage = useCallback((key: string): string => {
    // Check cache first
    if (messageCache.current.has(key)) {
      const cachedMessage = messageCache.current.get(key)
      return cachedMessage || key
    }

    try {
      // Dynamically import messages to avoid circular dependencies
      // cspell:disable-next-line
      const m = require('@/paraglide/messages')
      const message = m[key]?.() || key

      // Cache the result
      messageCache.current.set(key, message)
      return message
    } catch {
      messageCache.current.set(key, key)
      return key
    }
  }, [])

  // Clear cache when component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      messageCache.current.clear()
    }
  }, [])

  return { getMessage }
}

/**
 * Intersection observer hook for lazy loading and visibility detection
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const targetRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsIntersecting(entry.isIntersecting)
          if (entry.isIntersecting && !hasIntersected) {
            setHasIntersected(true)
          }
        }
      },
      {
        threshold: 0.1,
        ...options
      }
    )

    observer.observe(target)

    return () => {
      observer.unobserve(target)
    }
  }, [hasIntersected, options])

  return {
    targetRef,
    isIntersecting,
    hasIntersected
  }
}

/**
 * Optimized copy to clipboard hook with feedback
 */
export function useOptimizedClipboard() {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({})

  const copyToClipboard = useCallback(async (text: string, key = 'default') => {
    try {
      await navigator.clipboard.writeText(text)
      
      // Clear existing timeout for this key
      if (timeoutRefs.current[key]) {
        clearTimeout(timeoutRefs.current[key])
      }
      
      setCopiedStates(prev => ({ ...prev, [key]: true }))
      
      // Reset after 2 seconds
      timeoutRefs.current[key] = setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }))
        delete timeoutRefs.current[key]
      }, 2000)
      
      return true
    } catch {
      return false
    }
  }, [])

  const isCopied = useCallback((key = 'default') => {
    return copiedStates[key] || false
  }, [copiedStates])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout)
    }
  }, [])

  return { copyToClipboard, isCopied }
}

/**
 * Optimized animation frame hook for smooth animations
 */
export function useAnimationFrame(callback: (deltaTime: number) => void, deps: DependencyList = []) {
  const requestRef = useRef<number | undefined>(undefined)
  const previousTimeRef = useRef<number | undefined>(undefined)
  const callbackRef = useRef(callback)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current
      callbackRef.current(deltaTime)
    }
    previousTimeRef.current = time
    requestRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate)
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [animate, ...deps])

  const stopAnimation = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
    }
  }, [])

  return { stopAnimation }
}

/**
 * Optimized resize observer hook
 */
export function useResizeObserver<T extends HTMLElement>() {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0
  })
  const targetRef = useRef<T>(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })

    resizeObserver.observe(target)

    return () => {
      resizeObserver.unobserve(target)
    }
  }, [])

  return { targetRef, dimensions }
}

/**
 * Memory-efficient state management for large lists
 */
export function useVirtualizedState<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, items.length])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex)
  }, [items, visibleRange])

  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.startIndex * itemHeight

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
    visibleRange
  }
}

/**
 * Optimized event listener hook
 */
export function useOptimizedEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | HTMLElement | null = window,
  options?: AddEventListenerOptions
) {
  const savedHandler = useRef(handler)

  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    if (!element) return

    const eventListener = (event: Event) => {
      savedHandler.current(event as WindowEventMap[K])
    }

    element.addEventListener(eventName, eventListener, options)

    return () => {
      element.removeEventListener(eventName, eventListener, options)
    }
  }, [eventName, element, options])
}
