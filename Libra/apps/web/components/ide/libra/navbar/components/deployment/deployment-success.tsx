/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-success.tsx
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

import React, { useMemo, useCallback } from 'react'
import { Check, Rocket } from 'lucide-react'
import type { CustomDomainStatus } from '../../types/deployment'
import { CustomDomainSection } from './custom-domain-section'
import { UrlPreview, ActionButton } from './atoms'


import * as m from '@/paraglide/messages'

interface DeploymentSuccessProps {
  deployResult?: { workerUrl?: string; message?: string } | null
  existingUrl?: string
  customDomainStatus?: CustomDomainStatus
  onSetCustomDomain?: (domain: string) => Promise<void>
  onVerifyCustomDomain?: () => Promise<void>
  onRemoveCustomDomain?: () => Promise<void>
  isCustomDomainLoading?: boolean
  onClose: () => void
  onRedeploy?: () => Promise<void>
}

// Simplified header component
const DeploymentHeader = React.memo<{
  isNewDeployment: boolean
}>(({ isNewDeployment }) => (
  <div className="text-center space-y-3">
    {/* Success Icon */}
    <div className="relative inline-flex">
      <div
        className="w-12 h-12 mx-auto rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: 'linear-gradient(135deg, var(--deployment-color-success), #10b981)',
          borderRadius: 'var(--deployment-radius-xl)'
        }}
      >
        <Check className="w-6 h-6 text-white" aria-hidden="true" />
      </div>
    </div>

    {/* Success Message */}
    <h2 className="deployment-text-title text-foreground">
      {isNewDeployment
        ? m["ide.deployment.dialog.deploymentSuccessTitle"]()
        : m["ide.deployment.dialog.projectDeployedTitle"]()
      }
    </h2>
  </div>
))

DeploymentHeader.displayName = 'DeploymentHeader'

// Enhanced action buttons with new design system
const ActionButtons = React.memo<{
  onClose: () => void
  onRedeploy?: () => Promise<void>
  showRedeployButton: boolean
}>(({ onClose, onRedeploy, showRedeployButton }) => {
  const handleRedeploy = useCallback(async () => {
    if (onRedeploy) {
      await onRedeploy()
    }
  }, [onRedeploy])

  return (
    <div className="deployment-action-bar-responsive">
      <ActionButton
        intent="secondary"
        onClick={onClose}
        className="flex-1"
        aria-label={m["ide.deployment.dialog.closeDialogAriaLabel"]()}
      >
        {m["ide.deployment.dialog.close"]()}
      </ActionButton>
      {showRedeployButton && onRedeploy && (
        <ActionButton
          intent="primary"
          onClick={handleRedeploy}
          icon={Rocket}
          className="flex-1"
          aria-label={m["ide.deployment.dialog.redeployProjectAriaLabel"]()}
        >
          {m["ide.deployment.dialog.redeploy"]()}
        </ActionButton>
      )}
    </div>
  )
})

ActionButtons.displayName = 'ActionButtons'

export const DeploymentSuccess = React.memo<DeploymentSuccessProps>(({
  deployResult,
  existingUrl,
  customDomainStatus,
  onSetCustomDomain,
  onVerifyCustomDomain,
  onRemoveCustomDomain,
  isCustomDomainLoading = false,
  onClose,
  onRedeploy
}) => {
  const displayUrl = useMemo(() => deployResult?.workerUrl || existingUrl, [deployResult?.workerUrl, existingUrl])
  const isNewDeployment = useMemo(() => Boolean(deployResult?.workerUrl), [deployResult?.workerUrl])
  const showRedeployButton = useMemo(() => Boolean(displayUrl), [displayUrl])

  if (!displayUrl) {
    return null
  }

  return (
    <main
      className="deployment-section flex flex-col"
      style={{ gap: 'var(--deployment-section-gap)' }}
      aria-labelledby="deployment-success-title"
    >
      {/* Enhanced Success Header */}
      <DeploymentHeader isNewDeployment={isNewDeployment} />

      {/* Simplified URL Preview */}
      <UrlPreview
        url={displayUrl}
        status="live"
        showActions={true}
      />

      {/* Integrated Custom Domain Section */}
      {(onSetCustomDomain || customDomainStatus) && (
        <div className="deployment-card-enhanced">
          <CustomDomainSection
            {...(customDomainStatus && { customDomainStatus })}
            {...(onSetCustomDomain && { onSetCustomDomain })}
            {...(onVerifyCustomDomain && { onVerifyCustomDomain })}
            {...(onRemoveCustomDomain && { onRemoveCustomDomain })}
            isLoading={isCustomDomainLoading}
          />
        </div>
      )}

      {/* Enhanced Action Bar */}
      <ActionButtons
        onClose={onClose}
        onRedeploy={onRedeploy}
        showRedeployButton={showRedeployButton}
      />
    </main>
  )
})

DeploymentSuccess.displayName = 'DeploymentSuccess'
