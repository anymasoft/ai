/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * frame-viewer.tsx
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

import { forwardRef, useCallback, useEffect, useState, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'
import PreviewLoader from './preview-loader'

interface FrameViewerProps {
  src?: string | null
  isLoading?: boolean
  onLoad?: () => void
  className?: string
}

// Constants moved outside component to avoid dependency issues
const MAX_RETRIES = 3
const LOAD_TIMEOUT = 15000 // 15 seconds
const RETRY_DELAY = 2000 // 2 seconds

export const FrameViewer = forwardRef<HTMLIFrameElement, FrameViewerProps>(
  ({ src, isLoading: externalLoading = false, onLoad, className }, ref) => {
    // Internal state
    const [isContentLoaded, setIsContentLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [fadeOutLoading, setFadeOutLoading] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const [currentSrc, setCurrentSrc] = useState<string | null>(null)

    // Refs for tracking
    const loadTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
    const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
    const lastSrcRef = useRef<string | null>(null)

    // Determine if loading animation should be shown
    const shouldShowLoading = (!isContentLoaded && !fadeOutLoading) || externalLoading

    // Function to compare URLs meaningfully (ignoring cache-busting params)
    const areUrlsEquivalent = useCallback((url1: string | null, url2: string | null) => {
      if (url1 === url2) return true
      if (!url1 || !url2) return false

      try {
        const u1 = new URL(url1)
        const u2 = new URL(url2)

        // Compare base URLs
        if (u1.origin !== u2.origin || u1.pathname !== u2.pathname) {
          return false
        }

        // Compare non-cache-busting query parameters
        const params1 = new URLSearchParams(u1.search)
        const params2 = new URLSearchParams(u2.search)

        // Remove cache-busting and temporary parameters
        const tempParams = ['_retry', '_t', '_refresh']
        tempParams.forEach(param => {
          params1.delete(param)
          params2.delete(param)
        })

        // Compare remaining parameters
        return params1.toString() === params2.toString()
      } catch {
        return url1 === url2
      }
    }, [])

    // Create enhanced URL with cache-busting parameter only when retrying
    const enhancedSrc = useCallback((originalSrc: string | null) => {
      if (!originalSrc) return null

      // Only add cache-busting parameters during retries, not on normal URL changes
      if (retryCount > 0) {
        try {
          const url = new URL(originalSrc)
          // Add cache-busting parameter only for retries
          url.searchParams.set('_retry', retryCount.toString())
          url.searchParams.set('_t', Date.now().toString())
          return url.toString()
        } catch {
          return originalSrc
        }
      }

      // For normal URL changes, return as-is
      return originalSrc
    }, [retryCount])

    // Handle URL changes more intelligently
    useEffect(() => {
      const newSrc = src || null
      const previousSrc = currentSrc

      // Check if URL has meaningfully changed
      if (!areUrlsEquivalent(newSrc, previousSrc)) {
        // Clear any existing timeouts
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
        }
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }

        // Only update state and trigger reload if URL is truly different
        if (newSrc !== previousSrc) {
          // Reset all state
          setHasError(false)
          setErrorMessage('')
          setIsContentLoaded(false)
          setFadeOutLoading(false)
          setRetryCount(0)

          // Update current src
          setCurrentSrc(newSrc)
        }

        // Update last src reference
        lastSrcRef.current = newSrc
      }
    }, [src, currentSrc, areUrlsEquivalent])

    // Handle retry logic
    const handleRetry = useCallback(() => {
      if (retryCount >= MAX_RETRIES) {
        setHasError(true)
        setErrorMessage(m["browserPreview.frameViewer.loadError"]({ src: src || '' }))
        setIsContentLoaded(true)
        return
      }

      setRetryCount(prev => prev + 1)
      setHasError(false)
      setErrorMessage('')
      setIsContentLoaded(false)
      setFadeOutLoading(false)
    }, [retryCount, src])

    // Handle iframe load completion
    const handleIframeLoad = useCallback(() => {
      // Clear load timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }

      // Call parent callback to reset loading state
      if (onLoad) {
        onLoad()
      }

      // Set fade-out state to trigger transition
      setFadeOutLoading(true)

      // Delay setting content loaded state to allow for animation
      setTimeout(() => {
        setHasError(false)
        setErrorMessage('')
        setIsContentLoaded(true)
        setRetryCount(0)
      }, 400)
    }, [onLoad])

    // Handle iframe load error with retry logic
    const handleIframeError = useCallback(() => {
      // Clear load timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }

      // Try to retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        retryTimeoutRef.current = setTimeout(() => {
          handleRetry()
        }, RETRY_DELAY)
      } else {
        setHasError(true)
        setIsContentLoaded(true)
        setFadeOutLoading(false)
        setErrorMessage(m["browserPreview.frameViewer.loadError"]({ src: src || '' }))
      }
    }, [src, retryCount, handleRetry])

    // Set up load timeout when URL changes
    useEffect(() => {
      if (currentSrc && !isContentLoaded && !hasError) {
        loadTimeoutRef.current = setTimeout(() => {
          handleIframeError()
        }, LOAD_TIMEOUT)

        return () => {
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
          }
        }
      }
    }, [currentSrc, isContentLoaded, hasError, handleIframeError])

    // Get the final URL to use (with cache-busting if needed)
    const finalSrc = enhancedSrc(currentSrc || null)

    // Common iframe properties
    const iframeProps = {
      src: finalSrc || undefined,
      onLoad: handleIframeLoad,
      onError: handleIframeError,
      sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
      loading: 'eager' as const, // Changed from lazy to eager for better loading
      style: { border: 'none' },
    }

    // Cleanup timeouts on unmount
    useEffect(() => {
      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
        }
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }
      }
    }, [])

    // Error view with retry option
    const renderErrorView = () => (
      <div
        className={cn(
          'w-full h-full flex flex-col items-center justify-center p-4 dark:-subtle text-center'
        )}
      >
        <AlertTriangle className='text-warning-fg mb-4 h-12 w-12 dark:text-warning-fg' />
        <h3 className='font-medium text-fg-default dark:text-fg-default mb-2 text-lg'>
          {m["browserPreview.frameViewer.loadFailed"]()}
        </h3>
        <p className='text-fg-muted dark:text-fg-muted mb-2'>{errorMessage}</p>
        <p className='text-fg-subtle dark:text-fg-subtle text-sm mb-4'>
          {m["browserPreview.frameViewer.checkUrl"]()}
        </p>
        {retryCount < MAX_RETRIES && (
          <button
            type="button"
            onClick={handleRetry}
            className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
          >
            重试加载 ({retryCount}/{MAX_RETRIES})
          </button>
        )}
        {retryCount >= MAX_RETRIES && (
          <p className='text-fg-subtle dark:text-fg-subtle text-xs'>
              The maximum number of retries has been reached. Please check your network connection or refresh the page.
          </p>
        )}
      </div>
    )

    // Iframe view with loading animation
    const renderIframeWithLoading = () => (
      <div className='relative w-full h-full'>
        <iframe
          {...iframeProps}
          ref={ref}
          className={cn(
            'w-full h-full bg-white dark:bg-[#151515]',
            'transition-opacity duration-300',
            !isContentLoaded && 'opacity-0',
            isContentLoaded && 'opacity-100',
            className
          )}
          title={m["browserPreview.frameViewer.title"]()}
        />

        {/* Preview loading overlay */}
        {shouldShowLoading && (
          <div
            className={cn(
              'absolute inset-0',
              'transition-opacity duration-300',
              fadeOutLoading && 'opacity-0'
            )}
          >
            <PreviewLoader />
          </div>
        )}
      </div>
    )

    // Main render logic
    return (
      <div className='w-full h-full'>
        {hasError ? renderErrorView() : renderIframeWithLoading()}
      </div>
    )
  }
)

// Add display name for easier debugging
FrameViewer.displayName = 'FrameViewer'
