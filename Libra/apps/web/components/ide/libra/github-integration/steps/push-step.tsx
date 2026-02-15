/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * push-step.tsx
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
import Github from '@/components/logos/github'
import { RepositoryDisplay } from '../components/repository-display'
import type { GitHubRepository } from '../types'
import * as m from '@/paraglide/messages'

interface PushStepProps {
  selectedRepository: GitHubRepository | null
  isPushing: boolean
  pushError: string | null
  onBack: () => void
  onPush: () => void
}

export function PushStep({
  selectedRepository,
  isPushing,
  pushError,
  onBack,
  onPush
}: PushStepProps) {
  return (
    <div className="space-y-6">
      {/* Repository Information */}
      {selectedRepository && (
        <RepositoryDisplay
          repository={selectedRepository}
          showDescription={true}
        />
      )}

      {/* Files to Export */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground">{m['dashboard.integrations.github.push.files_title']()}</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            <span className="text-foreground font-medium">README.md</span>
            <span className="text-muted-foreground ml-auto">{m['dashboard.integrations.github.push.new_file']()}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            <span className="text-foreground font-medium">package.json</span>
            <span className="text-muted-foreground ml-auto">{m['dashboard.integrations.github.push.new_file']()}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {pushError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{pushError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1"
          disabled={isPushing}
        >
          {m['dashboard.integrations.github.push.back_button']()}
        </Button>
        <Button
          onClick={onPush}
          disabled={isPushing}
          variant="default"
          className="flex-1"
        >
          {isPushing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Github className="w-4 h-4 mr-2" />
          )}
          {m['dashboard.integrations.github.push.export_button']()}
        </Button>
      </div>
    </div>
  )
}
