/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * oauth-step.tsx
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

import { Button } from '@libra/ui/components/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { StatusCard } from '../components/status-card'
import { ActionCard } from '../components/action-card'
import type { GitHubInstallationStatus } from '../types'
import * as m from '@/paraglide/messages'

interface OAuthStepProps {
  installation: GitHubInstallationStatus | null
  isLoading: boolean
  error: string | null
  onAuthorize: () => void
}

export function OAuthStep({ installation, isLoading, error, onAuthorize }: OAuthStepProps) {
  const getAccountTypeMessage = () => {
    if (!installation) return ''

    const { installationType, accountLogin } = installation
    const account = accountLogin || ''

    if (installationType === 'user') {
      return m['dashboard.integrations.github.oauth.connected_personal']({ account })
    }

    if (installationType === 'organization') {
      return m['dashboard.integrations.github.oauth.connected_organization']({ account })
    }

    return m['dashboard.integrations.github.oauth.connected_generic']({ account })
  }

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <StatusCard
        variant="success"
        title={m['dashboard.integrations.github.oauth.app_connected']()}
        description={getAccountTypeMessage()}
      />

      {/* Authorization Card */}
      <ActionCard
        title={m['dashboard.integrations.github.oauth.access_required']()}
        description={m['dashboard.integrations.github.oauth.access_description']()}
        buttonText={m['dashboard.integrations.github.oauth.authorize_button']()}
        buttonVariant="default"
        buttonSize="default"
        isLoading={isLoading}
        onClick={onAuthorize}
        icon={isLoading ? undefined : <AlertCircle className="w-4 h-4" />}
        className="w-full"
      />

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs">{error}</span>
        </div>
      )}
    </div>
  )
}
