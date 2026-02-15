/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * accessibility-helpers.tsx
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

import { useEffect, useRef } from 'react'
import { cn } from '@libra/ui/lib/utils'

/**
 * Screen reader only text component
 */
interface ScreenReaderOnlyProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export function ScreenReaderOnly({ children, className, id }: ScreenReaderOnlyProps) {
  return (
    <span
      id={id}
      className={cn(
        "sr-only absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0",
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * Live region for announcing dynamic content changes
 */
interface LiveRegionProps {
  children: React.ReactNode
  politeness?: 'polite' | 'assertive' | 'off'
  atomic?: boolean
  className?: string
}

export function LiveRegion({ 
  children, 
  politeness = 'polite', 
  atomic = false,
  className 
}: LiveRegionProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn("sr-only", className)}
    >
      {children}
    </div>
  )
}

/**
 * Progress announcer for deployment progress
 */
interface ProgressAnnouncerProps {
  progress: number
  stage: string
  isDeploying: boolean
}

export function ProgressAnnouncer({ progress, stage, isDeploying }: ProgressAnnouncerProps) {
  const previousProgress = useRef(progress)
  const announceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only announce significant progress changes (every 10%) or stage changes
    const progressChanged = Math.floor(progress / 10) !== Math.floor(previousProgress.current / 10)
    const stageChanged = stage !== announceRef.current?.dataset.lastStage

    if (isDeploying && (progressChanged || stageChanged)) {
      let announcement = ''

      if (progressChanged) {
        announcement = `部署进度：${progress}%。`
      }

      if (stageChanged) {
        announcement += `当前阶段：${stage}。`
      }

      // Add estimated time for better UX
      if (progress > 0 && progress < 100) {
        const estimatedMinutes = Math.ceil((100 - progress) / 10)
        announcement += `预计还需 ${estimatedMinutes} 分钟。`
      }

      if (announceRef.current) {
        announceRef.current.textContent = announcement
        announceRef.current.dataset.lastStage = stage
      }

      previousProgress.current = progress
    }
  }, [progress, stage, isDeploying])

  return (
    <LiveRegion politeness="polite">
      <div ref={announceRef} />
    </LiveRegion>
  )
}

/**
 * Status announcer for deployment status changes
 */
interface StatusAnnouncerProps {
  status: string
  message?: string
}

export function StatusAnnouncer({ status, message }: StatusAnnouncerProps) {
  const previousStatus = useRef(status)

  useEffect(() => {
    if (status !== previousStatus.current) {
      previousStatus.current = status
    }
  }, [status])

  return (
    <LiveRegion politeness="assertive">
      {status !== previousStatus.current && (
        <div>
          {message || `Deployment status changed to: ${status}`}
        </div>
      )}
    </LiveRegion>
  )
}

/**
 * Focus management hook for modal dialogs
 */
export function useFocusManagement(isOpen: boolean) {
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement
      
      // Focus the container or first focusable element
      const container = containerRef.current
      if (container) {
        const firstFocusable = container.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement
        
        if (firstFocusable) {
          firstFocusable.focus()
        } else {
          container.focus()
        }
      }
    } else {
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
        previousActiveElement.current = null
      }
    }
  }, [isOpen])

  return containerRef
}

/**
 * Keyboard navigation helper
 */
interface KeyboardNavigationProps {
  children: React.ReactNode
  onEscape?: () => void
  onEnter?: () => void
  className?: string
}

export function KeyboardNavigation({ 
  children, 
  onEscape, 
  onEnter, 
  className 
}: KeyboardNavigationProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        if (onEscape) {
          event.preventDefault()
          onEscape()
        }
        break
      case 'Enter':
        if (onEnter && event.target === event.currentTarget) {
          event.preventDefault()
          onEnter()
        }
        break
    }
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      className={className}
      tabIndex={-1}
    >
      {children}
    </div>
  )
}

/**
 * Enhanced button with loading state accessibility
 */
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
}

export function AccessibleButton({ 
  isLoading, 
  loadingText, 
  children, 
  disabled,
  ...props 
}: AccessibleButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      aria-describedby={isLoading ? `${props.id}-loading` : undefined}
    >
      {children}
      {isLoading && (
        <ScreenReaderOnly id={`${props.id}-loading`}>
          {loadingText || 'Loading...'}
        </ScreenReaderOnly>
      )}
    </button>
  )
}

/**
 * Progress bar with enhanced accessibility
 */
interface AccessibleProgressProps {
  value: number
  max?: number
  label?: string
  description?: string
  className?: string
}

export function AccessibleProgress({ 
  value, 
  max = 100, 
  label, 
  description,
  className 
}: AccessibleProgressProps) {
  const progressId = useRef(`progress-${Math.random().toString(36).substr(2, 9)}`)
  const labelId = useRef(`${progressId.current}-label`)
  const descId = useRef(`${progressId.current}-desc`)

  return (
    <div className={className}>
      {label && (
        <div id={labelId.current} className="text-sm font-medium mb-2">
          {label}
        </div>
      )}
      {description && (
        <div id={descId.current} className="text-xs text-muted-foreground mb-2">
          {description}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-labelledby={label ? labelId.current : undefined}
        aria-describedby={description ? descId.current : undefined}
        className="w-full bg-muted/50 rounded-full h-3 overflow-hidden shadow-inner"
      >
        <div
          className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-700 ease-out relative"
          style={{ width: `${(value / max) * 100}%` }}
        >
          {/* Animated shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </div>
      <ScreenReaderOnly>
        {Math.round((value / max) * 100)}% complete
      </ScreenReaderOnly>
    </div>
  )
}

/**
 * Enhanced keyboard navigation hook
 */
export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    enableArrowKeys?: boolean
    enableTabTrapping?: boolean
    onEscape?: () => void
    autoFocus?: boolean
  } = {}
) {
  const { enableArrowKeys = true, enableTabTrapping = true, onEscape, autoFocus = true } = options

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Auto focus first focusable element
    if (autoFocus) {
      const firstFocusable = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        onEscape()
        return
      }

      // Handle Tab trapping
      if (enableTabTrapping && event.key === 'Tab') {
        const focusableElements = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )

        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        // Ensure both elements exist before proceeding
        if (!firstElement || !lastElement) return

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }

      // Handle Arrow key navigation
      if (enableArrowKeys && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const focusableElements = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )

        const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
        if (currentIndex === -1) return

        let nextIndex = currentIndex

        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowLeft':
            nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1
            break
          case 'ArrowDown':
          case 'ArrowRight':
            nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0
            break
        }

        event.preventDefault()
        focusableElements[nextIndex]?.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, enableArrowKeys, enableTabTrapping, onEscape, autoFocus])
}



/**
 * Enhanced ARIA announcer for complex state changes
 */
interface AriaAnnouncerProps {
  message: string
  priority?: 'polite' | 'assertive'
  delay?: number
}

export function useAriaAnnouncer() {
  const announceRef = useRef<HTMLDivElement>(null)

  const announce = ({ message, priority = 'polite', delay = 100 }: AriaAnnouncerProps) => {
    if (!announceRef.current) return

    // Clear previous message
    announceRef.current.textContent = ''

    // Set new message after a brief delay to ensure screen readers pick it up
    setTimeout(() => {
      if (announceRef.current) {
        announceRef.current.setAttribute('aria-live', priority)
        announceRef.current.textContent = message
      }
    }, delay)
  }

  const AnnouncerComponent = () => (
    <div
      ref={announceRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  )

  return { announce, AnnouncerComponent }
}
