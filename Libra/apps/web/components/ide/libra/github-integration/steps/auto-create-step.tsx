/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * auto-create-step.tsx
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
import { Loader2 } from 'lucide-react'
import Github from '@/components/logos/github'
import { StatusCard } from '../components/status-card'
import type { ProjectRepositoryInfo } from '../types'
import * as m from '@/paraglide/messages'

interface AutoCreateStepProps {
  projectRepoInfo: ProjectRepositoryInfo | null
  isCreating: boolean
  onSelectExisting: () => void
}

export function AutoCreateStep({
  projectRepoInfo,
  isCreating,
  onSelectExisting
}: AutoCreateStepProps) {
  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="text-center space-y-3 py-4 bg-gradient-to-b from-muted/30 to-background rounded-lg border">
        <div className="mx-auto w-10 h-10 bg-background rounded-full flex items-center justify-center shadow border">
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <Github className="w-5 h-5 text-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            {isCreating ? m['dashboard.integrations.github.auto_create.creating_title']() : m['dashboard.integrations.github.auto_create.ready_title']()}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isCreating
              ? m['dashboard.integrations.github.auto_create.creating_description']()
              : m['dashboard.integrations.github.auto_create.ready_description']()
            }
          </p>
        </div>
      </div>

      {/* Project Information */}
      {projectRepoInfo && (
        <StatusCard
          variant="info"
          title={m['dashboard.integrations.github.auto_create.project_title']({ name: projectRepoInfo.projectName })}
          description={
            isCreating
              ? m['dashboard.integrations.github.auto_create.creating_project_description']()
              : m['dashboard.integrations.github.auto_create.ready_project_description']()
          }
        />
      )}

      {/* Progress Indicator */}
      {isCreating && (
        <div className="flex items-center justify-center py-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{m['dashboard.integrations.github.auto_create.progress_message']()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Alternative Action */}
      {!isCreating && (
        <Button
          onClick={onSelectExisting}
          variant="outline"
          size="default"
          className="w-full"
        >
          {m['dashboard.integrations.github.auto_create.select_existing_button']()}
        </Button>
      )}
    </div>
  )
}
