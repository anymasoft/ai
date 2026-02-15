/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * auto-fix-button.tsx
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

import * as m from '@/paraglide/messages'
import { Button } from '@libra/ui/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@libra/ui/components/tooltip'
import { cn } from '@libra/ui/lib/utils'
import { Wrench, Loader2 } from 'lucide-react'

interface ErrorInfo {
  message: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string
  blankScreen?: boolean
}

interface AutoFixButtonProps {
  /** Detected errors from iframe monitoring */
  detectedErrors?: ErrorInfo[]
  /** Callback when Auto Fix is triggered */
  onAutoFix?: (errors: ErrorInfo[]) => void
  /** Whether Auto Fix is currently processing */
  isProcessing?: boolean
  /** Whether the button should be disabled */
  disabled?: boolean
  /** Whether quota is exceeded */
  quotaExceeded?: boolean
}

/**
 * Auto Fix button component - appears when errors are detected from iframe monitoring
 */
export const AutoFixButton = ({
  detectedErrors = [],
  onAutoFix,
  isProcessing = false,
  disabled = false,
  quotaExceeded = false,
}: AutoFixButtonProps) => {
  // Only show if there are errors and not quota exceeded
  const hasErrors = detectedErrors.length > 0
  const shouldShow = hasErrors && !quotaExceeded
  
  if (!shouldShow) {
    return null
  }

  const handleAutoFix = () => {
    if (disabled || isProcessing || quotaExceeded) return
    onAutoFix?.(detectedErrors)
  }

  const isDisabled = disabled || isProcessing || quotaExceeded

  return (
    <div className="mb-3 animate-in fade-in-50 slide-in-from-top-2 duration-300">
      <div className={cn(
        'flex items-center gap-2 p-3 rounded-lg border',
        'dark:bg-amber-900/10 dark:border-amber-700/30 dark:text-amber-300',
        'bg-amber-50 border-amber-200 text-amber-700'
      )}>
        {/* Error count indicator */}
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          'dark:text-amber-400 text-amber-600'
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            'dark:bg-amber-400 bg-amber-500'
          )} />
          <span>
            {m["chatPanel.autoFix.errorsDetected"]({
              count: detectedErrors.length,
              plural: detectedErrors.length > 1 ? 's' : ''
            })}
          </span>
        </div>

        {/* Auto Fix button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={handleAutoFix}
              disabled={isDisabled}
              size="sm"
              variant="outline"
              className={cn(
                'ml-auto transition-all duration-200 transform active:scale-95',
                'focus-visible:ring-offset-2',
                'dark:focus-visible:ring-offset-neutral-800 focus-visible:ring-offset-white',
                !isDisabled && [
                  'dark:bg-amber-600 dark:hover:bg-amber-700 dark:focus-visible:ring-amber-500 dark:text-white',
                  'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400 text-white border-amber-500'
                ],
                isDisabled && [
                  'opacity-50 cursor-not-allowed',
                  'dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600',
                  'bg-gray-200 text-gray-400 border-gray-300'
                ]
              )}
              aria-label={
                quotaExceeded
                  ? m["chatPanel.autoFix.aria.quotaExceeded"]()
                  : isProcessing
                    ? m["chatPanel.autoFix.aria.processing"]()
                    : m["chatPanel.autoFix.aria.button"]({
                        count: detectedErrors.length,
                        plural: detectedErrors.length > 1 ? 's' : ''
                      })
              }
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  <span className="text-xs">{m["chatPanel.autoFix.processing"]()}</span>
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-1.5" />
                  <span className="text-xs">{m["chatPanel.autoFix.button"]()}</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {quotaExceeded
              ? m["chatPanel.autoFix.tooltip.quotaExceeded"]()
              : isProcessing
                ? m["chatPanel.autoFix.tooltip.processing"]()
                : m["chatPanel.autoFix.tooltip.fix"]({
                    count: detectedErrors.length,
                    plural: detectedErrors.length > 1 ? 's' : ''
                  })
            }
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Error details (collapsible preview) */}
      {hasErrors && (
        <div className={cn(
          'mt-2 p-2 rounded-md text-xs',
          'dark:bg-neutral-800/50 dark:text-neutral-400 dark:border-neutral-700',
          'bg-gray-50 text-gray-600 border border-gray-200'
        )}>
          <div className="font-medium mb-1">{m["chatPanel.autoFix.recentErrors"]()}</div>
          <div className="space-y-1">
            {detectedErrors.slice(0, 3).map((error, index) => (
              <div key={index} className="truncate">
                <span className="font-mono">{error.message}</span>
                {error.filename && (
                  <span className="ml-2 opacity-70">
                    at {error.filename}
                    {error.lineno && `:${error.lineno}`}
                  </span>
                )}
              </div>
            ))}
            {detectedErrors.length > 3 && (
              <div className="opacity-70">
                {m["chatPanel.autoFix.andMore"]({ count: detectedErrors.length - 3 })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
