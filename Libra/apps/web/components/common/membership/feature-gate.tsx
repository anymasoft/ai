/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * feature-gate.tsx
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

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useFeatureAccess, type FeatureName } from '@/hooks/use-feature-access'
import { UpgradePrompt, type UpgradeVariant } from './upgrade-prompt'

/**
 * Feature gate props
 */
export interface FeatureGateProps {
  feature: FeatureName
  children: ReactNode
  fallback?: ReactNode
  upgradePrompt?: {
    title?: string
    message?: string
    variant?: UpgradeVariant
    size?: 'sm' | 'md' | 'lg'
  }
  showLoadingState?: boolean
  className?: string
}

/**
 * Feature gate component
 * Conditionally renders content based on feature access
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  upgradePrompt,
  showLoadingState = true,
  className,
}: FeatureGateProps) {
  const {
    hasAccess,
    isLoading,
    requiresUpgrade,
    upgradeMessage,
    handleUpgrade,
  } = useFeatureAccess(feature)

  // Show loading state
  if (isLoading && showLoadingState) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  // Show content if user has access
  if (hasAccess) {
    return <>{children}</>
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>
  }

  // Show upgrade prompt if user needs to upgrade
  if (requiresUpgrade) {
    return (
      <div className={className}>
        <UpgradePrompt
          title={upgradePrompt?.title}
          message={upgradePrompt?.message || upgradeMessage}
          variant={upgradePrompt?.variant || 'card'}
          size={upgradePrompt?.size || 'md'}
          onUpgrade={handleUpgrade}
        />
      </div>
    )
  }

  // Default: don't render anything
  return null
}

/**
 * Feature wrapper component
 * Wraps content with feature access checking
 */
export interface FeatureWrapperProps {
  feature: FeatureName
  children: ReactNode
  onAccessDenied?: () => void
  showUpgradePrompt?: boolean
  upgradePromptProps?: FeatureGateProps['upgradePrompt']
}

export function FeatureWrapper({
  feature,
  children,
  onAccessDenied,
  showUpgradePrompt = true,
  upgradePromptProps,
}: FeatureWrapperProps) {
  const { hasAccess, requiresUpgrade, upgradeMessage, handleUpgrade } = useFeatureAccess(feature)

  // Call access denied callback if provided
  if (!hasAccess && onAccessDenied) {
    onAccessDenied()
  }

  // Always render children, but they might be disabled
  if (!hasAccess && showUpgradePrompt && requiresUpgrade) {
    return (
      <div className="space-y-4">
        <UpgradePrompt
          title={upgradePromptProps?.title}
          message={upgradePromptProps?.message || upgradeMessage}
          variant={upgradePromptProps?.variant || 'banner'}
          size={upgradePromptProps?.size || 'md'}
          onUpgrade={handleUpgrade}
        />
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Conditional feature component
 * Renders different content based on feature access
 */
export interface ConditionalFeatureProps {
  feature: FeatureName
  hasAccess: ReactNode
  noAccess: ReactNode
  loading?: ReactNode
}

export function ConditionalFeature({
  feature,
  hasAccess,
  noAccess,
  loading,
}: ConditionalFeatureProps) {
  const featureAccess = useFeatureAccess(feature)

  if (featureAccess.isLoading && loading) {
    return loading
  }

  return featureAccess.hasAccess ? hasAccess : noAccess
}

/**
 * Feature button component
 * Button that shows upgrade prompt when feature is not accessible
 */
export interface FeatureButtonProps {
  feature: FeatureName
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function FeatureButton({
  feature,
  children,
  onClick,
  disabled = false,
  className,
}: FeatureButtonProps) {
  const {
    hasAccess,
    requiresUpgrade,
    upgradeMessage: defaultUpgradeMessage,
    handleUpgrade,
  } = useFeatureAccess(feature)

  const handleClick = () => {
    if (hasAccess && onClick) {
      onClick()
    } else if (requiresUpgrade) {
      handleUpgrade()
    }
  }

  // If no access and requires upgrade, show as upgrade button
  if (!hasAccess && requiresUpgrade) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={className}
        title={defaultUpgradeMessage}
      >
        {children}
      </button>
    )
  }

  // Regular button behavior
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !hasAccess}
      className={className}
    >
      {children}
    </button>
  )
}
