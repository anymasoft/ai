/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-error.tsx
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

import { AlertTriangle, RefreshCw, HelpCircle, ExternalLink, Bug } from 'lucide-react'
import { ActionButton } from './atoms'
import { DeploymentStatusIndicator } from './atoms/deployment-status-indicator'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'

export interface DeploymentErrorProps {
  error: Error | string
  onRetry?: () => void | Promise<void>
  onClose?: () => void
  onGetHelp?: () => void
  className?: string
  showDetails?: boolean
}

/**
 * Enhanced deployment error component with better UX
 */
export function DeploymentError({
  error,
  onRetry,
  onClose,
  onGetHelp,
  className,
  showDetails = false
}: DeploymentErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error.message
  const errorStack = typeof error === 'string' ? null : error.stack

  // Categorize error types for better user guidance
  const getErrorCategory = (message: string) => {
    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: 'network',
        title: m['ide.deployment.error.categories.network.title'](),
        description: m['ide.deployment.error.categories.network.description'](),
        suggestion: m['ide.deployment.error.categories.network.suggestion']()
      }
    }
    if (message.includes('timeout')) {
      return {
        type: 'timeout',
        title: m['ide.deployment.error.categories.timeout.title'](),
        description: m['ide.deployment.error.categories.timeout.description'](),
        suggestion: m['ide.deployment.error.categories.timeout.suggestion']()
      }
    }
    if (message.includes('build') || message.includes('compile')) {
      return {
        type: 'build',
        title: m['ide.deployment.error.categories.build.title'](),
        description: m['ide.deployment.error.categories.build.description'](),
        suggestion: m['ide.deployment.error.categories.build.suggestion']()
      }
    }
    return {
      type: 'unknown',
      title: m['ide.deployment.error.categories.unknown.title'](),
      description: m['ide.deployment.error.categories.unknown.description'](),
      suggestion: m['ide.deployment.error.categories.unknown.suggestion']()
    }
  }

  const errorCategory = getErrorCategory(errorMessage)

  return (
    <main 
      className={cn(
        "deployment-section flex flex-col text-center",
        className
      )}
      style={{ gap: 'var(--deployment-section-gap)' }}
      role="alert"
      aria-labelledby="deployment-error-title"
    >
      {/* Error Icon and Status */}
      <div className="flex flex-col items-center space-y-4">
        <div 
          className="relative w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, var(--deployment-color-error), #dc2626)',
            borderRadius: 'var(--deployment-radius-xl)'
          }}
        >
          <AlertTriangle className="w-8 h-8 text-white" aria-hidden="true" />
        </div>

        <DeploymentStatusIndicator
          status="error"
          message={m['ide.deployment.error.deploymentFailed']()}
          size="sm"
          showAnimation={false}
        />
      </div>

      {/* Error Information Card */}
      <div className="deployment-card-enhanced deployment-status-error">
        <div className="space-y-4">
          <div>
            <h2 
              id="deployment-error-title"
              className="deployment-text-title text-foreground"
            >
              {errorCategory.title}
            </h2>
            <p className="deployment-text-body text-muted-foreground mt-2">
              {errorCategory.description}
            </p>
          </div>

          {/* Error Message */}
          <div className="p-3 bg-muted/50 rounded-lg text-left">
            <p className="deployment-text-caption font-mono text-muted-foreground">
              {errorMessage}
            </p>
          </div>

          {/* Suggestion */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="deployment-text-caption text-blue-700 dark:text-blue-300 text-left">
                {errorCategory.suggestion}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Details (Development/Debug) */}
      {showDetails && errorStack && (
        <div className="deployment-card-enhanced">
          <details className="text-left">
            <summary className="cursor-pointer deployment-text-subtitle font-semibold mb-3 text-muted-foreground hover:text-foreground transition-colors">
              <Bug className="w-4 h-4 inline mr-2" />
              {m['ide.deployment.error.details.technicalDetails']()}
            </summary>
            <div className="deployment-text-caption font-mono bg-muted/50 p-3 rounded-lg overflow-auto max-h-40">
              <pre className="whitespace-pre-wrap text-xs">
                {errorStack}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Action Buttons */}
      <div className="deployment-action-bar">
        {onClose && (
          <ActionButton
            intent="secondary"
            onClick={onClose}
            className="flex-1"
            aria-label={m['ide.deployment.error.actions.closeAriaLabel']()}
          >
            {m['ide.deployment.error.actions.close']()}
          </ActionButton>
        )}
        {onRetry && (
          <ActionButton
            intent="primary"
            onClick={onRetry}
            icon={RefreshCw}
            className="flex-1"
            aria-label={m['ide.deployment.error.actions.retryAriaLabel']()}
          >
            {m['ide.deployment.error.actions.retry']()}
          </ActionButton>
        )}
        {onGetHelp && (
          <ActionButton
            intent="secondary"
            onClick={onGetHelp}
            icon={ExternalLink}
            className="flex-1"
            aria-label={m['ide.deployment.error.actions.getHelpAriaLabel']()}
          >
            {m['ide.deployment.error.actions.getHelp']()}
          </ActionButton>
        )}
      </div>

      {/* Quick Help Links */}
      <div className="deployment-card-enhanced">
        <div className="space-y-3">
          <h3 className="deployment-text-subtitle font-semibold text-foreground">
            {m['ide.deployment.error.solutions.title']()}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-muted/30 rounded-lg">
              <h4 className="deployment-text-caption font-medium text-foreground">
                {m['ide.deployment.error.solutions.checkCode.title']()}
              </h4>
              <p className="deployment-text-caption text-muted-foreground mt-1">
                {m['ide.deployment.error.solutions.checkCode.description']()}
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <h4 className="deployment-text-caption font-medium text-foreground">
                {m['ide.deployment.error.solutions.checkNetwork.title']()}
              </h4>
              <p className="deployment-text-caption text-muted-foreground mt-1">
                {m['ide.deployment.error.solutions.checkNetwork.description']()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * Compact error display for inline use
 */
export function CompactDeploymentError({
  error,
  onRetry,
  className
}: {
  error: Error | string
  onRetry?: () => void
  className?: string
}) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div className={cn(
      "flex items-center deployment-button-spacing p-3 rounded-lg",
      "deployment-status-error border",
      className
    )}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span className="deployment-text-body flex-1 text-left">
        {errorMessage}
      </span>
      {onRetry && (
        <ActionButton
          intent="secondary"
          onClick={onRetry}
          icon={RefreshCw}
          className="h-8 px-2 text-xs"
          aria-label={m['ide.deployment.error.actions.retryAriaLabel']()}
        >
          {m['common.retry']()}
        </ActionButton>
      )}
    </div>
  )
}
