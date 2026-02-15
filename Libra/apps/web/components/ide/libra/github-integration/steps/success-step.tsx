/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * success-step.tsx
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

import Github from '@/components/logos/github'
import { StatusCard } from '../components/status-card'
import { ActionCard } from '../components/action-card'
import { RepositoryDisplay } from '../components/repository-display'
import { Switch } from '@libra/ui/components/switch'
import { Label } from '@libra/ui/components/label'
import type { GitHubRepository, GitHubInstallationStatus, ProjectRepositoryInfo } from '../types'
import * as m from '@/paraglide/messages'

// Temporary flag to disable force push functionality (sync is still available)
const FORCE_PUSH_DISABLED = true

interface SuccessStepProps {
  installation: GitHubInstallationStatus | null
  selectedRepository: GitHubRepository | null
  projectRepoInfo: ProjectRepositoryInfo | null
  isPushing: boolean
  isAuthLoading: boolean
  forcePush: boolean
  onAuthorize: () => void
  onPushCode: () => void
  onForcePushChange: (forcePush: boolean) => void
}

export function SuccessStep({
  installation,
  selectedRepository,
  projectRepoInfo,
  isPushing,
  isAuthLoading,
  forcePush,
  onAuthorize,
  onPushCode,
  onForcePushChange
}: SuccessStepProps) {
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

  // Determine repository info based on context (project-based or manual flow)
  const repositoryUrl = projectRepoInfo?.gitUrl
    ? projectRepoInfo.gitUrl.replace('.git', '').replace('https://github.com/', 'https://github.com/')
    : selectedRepository?.html_url

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <StatusCard
        variant="success"
        title={m['dashboard.integrations.github.success.ready_title']()}
        description={getAccountTypeMessage()}
      />

      {/* Action Cards */}
      <div className="space-y-3">
        {/* Repository Access Card */}
        <ActionCard
          title={m['dashboard.integrations.github.success.access_title']()}
          description={m['dashboard.integrations.github.success.access_description']()}
          buttonText={m['dashboard.integrations.github.success.authorize_button']()}
          buttonVariant="outline"
          buttonSize="sm"
          isLoading={isAuthLoading}
          onClick={onAuthorize}
        />

        {/* Export Repository Card */}
        <ActionCard
          title={m['dashboard.integrations.github.success.export_title']()}
          description={m['dashboard.integrations.github.success.export_description']()}
          buttonText={m['dashboard.integrations.github.success.sync_button']()}
          buttonVariant="default"
          buttonSize="sm"
          isLoading={isPushing}
          onClick={onPushCode}
          icon={!isPushing ? <Github className="w-3 h-3" /> : undefined}
        >
          {/* Force Push Toggle */}
          <div className={`flex items-center justify-between mt-3 p-3 bg-muted/30 rounded-md ${FORCE_PUSH_DISABLED ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <Label htmlFor="force-push-toggle" className="text-sm font-medium">
                Force Push
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {FORCE_PUSH_DISABLED
                  ? "Force push is enabled by default for this deployment"
                  : "Override existing files in the repository (use with caution)"
                }
              </p>
            </div>
            <Switch
              id="force-push-toggle"
              checked={FORCE_PUSH_DISABLED ? true : forcePush}
              onCheckedChange={FORCE_PUSH_DISABLED ? () => {} : onForcePushChange}
              disabled={FORCE_PUSH_DISABLED}
              aria-label="Enable force push"
            />
          </div>

          {/* Repository URL Display */}
          {repositoryUrl && (
            <RepositoryDisplay
              repositoryUrl={repositoryUrl}
              showCopyButton={true}
              className="mt-3"
            />
          )}
        </ActionCard>
      </div>
    </div>
  )
}
