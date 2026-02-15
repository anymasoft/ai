/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * turnstile-widget.tsx
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

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import React, { useCallback, useRef, useState } from 'react'
import { env } from '../../../env.mjs'

interface TurnstileWidgetComponentProps {
  onSuccess: (token: string) => void
  onError?: (error: string) => void
  onExpire?: () => void
  onLoad?: () => void
  className?: string
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
  disabled?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
}

/**
 * Turnstile CAPTCHA widget component
 * Integrates Cloudflare Turnstile with the existing design system
 */
const TurnstileWidget = React.forwardRef<TurnstileWidgetRef, TurnstileWidgetComponentProps>(
  (
    {
      onSuccess,
      onError,
      onExpire,
      onLoad,
      className = '',
      theme = 'dark',
      size = 'normal',
      disabled = false,
      'aria-label': ariaLabel = 'CAPTCHA verification',
      'aria-describedby': ariaDescribedBy,
    },
    ref
  ) => {
    const turnstileRef = useRef<TurnstileInstance | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isVerified, setIsVerified] = useState(false)
    const [hasError, setHasError] = useState(false)

    const handleSuccess = useCallback(
      (token: string) => {
        setIsLoading(false)
        setIsVerified(true)
        setHasError(false)
        onSuccess(token)
      },
      [onSuccess]
    )

    const handleError = useCallback(
      (error: string) => {
        setIsLoading(false)
        setIsVerified(false)
        setHasError(true)
        onError?.(error)
      },
      [onError]
    )

    const handleExpire = useCallback(() => {
      setIsLoading(false)
      setIsVerified(false)
      setHasError(false)
      onExpire?.()
    }, [onExpire])

    const handleLoad = useCallback(() => {
      setIsLoading(false)
      onLoad?.()
    }, [onLoad])

    // Reset the widget programmatically
    const reset = useCallback(() => {
      if (turnstileRef.current) {
        turnstileRef.current.reset()
      }
      // Reset internal state
      setIsLoading(true)
      setIsVerified(false)
      setHasError(false)
    }, [])

    // Get current response token
    const getResponse = useCallback((): string | undefined => {
      if (turnstileRef.current) {
        const response = turnstileRef.current.getResponse()
        return response || undefined
      }
      return undefined
    }, [])

    // Expose methods to parent components via ref
    React.useImperativeHandle(ref, () => ({
      reset,
      getResponse,
      remove: () => turnstileRef.current?.remove(),
      render: () => turnstileRef.current?.render(),
    }))

    if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      return null
    }

    // Generate unique IDs for accessibility
    const widgetId = React.useId()
    const statusId = `${widgetId}-status`
    const errorId = `${widgetId}-error`

    return (
      <div
        className={`turnstile-widget-wrapper ${className}`}
        data-loading={isLoading}
        data-verified={isVerified}
        data-error={hasError}
        aria-label={ariaLabel}
        aria-describedby={
          ariaDescribedBy || (hasError ? errorId : isVerified ? statusId : undefined)
        }
        style={{
          // Ensure proper containment and isolation
          contain: 'layout style',
          isolation: 'isolate',
          // Prevent margin collapse and ensure proper spacing
          display: 'block',
          width: '100%',
          // Reset any inherited styles that might affect the iframe
          lineHeight: 'normal',
          fontSize: 'initial',
          fontFamily: 'initial',
        }}
      >
        <div
          className='turnstile-container'
          style={{
            // Create a stable container for the Turnstile iframe
            position: 'relative',
            width: '100%',
            minHeight: size === 'compact' ? '65px' : '65px', // Standard Turnstile height
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            // Ensure iframe doesn't inherit problematic styles
            background: 'transparent',
            border: 'none',
            outline: 'none',
            // Prevent any layout shifts
            overflow: 'hidden',
          }}
        >
          <Turnstile
            ref={turnstileRef}
            siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onSuccess={handleSuccess}
            onError={handleError}
            onExpire={handleExpire}
            onLoad={handleLoad}
            options={{
              theme,
              size,
              retry: 'auto',
              retryInterval: 8000,
              refreshExpired: 'auto',
              appearance: 'always',
              execution: 'render',
            }}
            style={{
              opacity: disabled ? 0.5 : 1,
              pointerEvents: disabled ? 'none' : 'auto',
              // Ensure the iframe doesn't inherit unwanted styles
              maxWidth: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
        </div>

        {/* Status messages for accessibility and user feedback */}
        {isLoading && (
          <div id={statusId} className='sr-only' aria-live='polite'>
            Loading CAPTCHA verification...
          </div>
        )}

        {isVerified && (
          <div id={statusId} className='sr-only' aria-live='polite'>
            CAPTCHA verification completed successfully
          </div>
        )}

        {hasError && (
          <div id={errorId} className='sr-only' aria-live='assertive'>
            CAPTCHA verification failed. Please try again.
          </div>
        )}

        {/* Error display for development */}
        {process.env.NODE_ENV === 'development' && !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div className='text-red-500 text-sm mt-2 text-center'>
            Warning: NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured
          </div>
        )}
      </div>
    )
  }
)

TurnstileWidget.displayName = 'TurnstileWidget'

// Export the ref type for parent components
export type TurnstileWidgetRef = {
  reset: () => void
  getResponse: () => string | undefined
  remove: () => void
  render: () => void
}

export default TurnstileWidget
