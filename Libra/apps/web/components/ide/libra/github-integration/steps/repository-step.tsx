/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * repository-step.tsx
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
import { Badge } from '@libra/ui/components/badge'
import { Plus, ExternalLink, Star, GitFork } from 'lucide-react'
import { StatusCard } from '../components/status-card'
import type { GitHubRepository, GitHubInstallationStatus } from '../types'
import * as m from '@/paraglide/messages'

interface RepositoryStepProps {
  installation: GitHubInstallationStatus | null
  repositories: GitHubRepository[]
  onRepositorySelect: (repository: GitHubRepository) => void
  onCreateNew?: () => void
}

export function RepositoryStep({
  installation,
  repositories,
  onRepositorySelect,
  onCreateNew
}: RepositoryStepProps) {
  return (
    <div className="space-y-3">
      {/* Installation Status */}
      {installation && (
        <StatusCard
          variant="success"
          title={`Connected to ${installation.accountLogin}`}
          description={`${installation.installationType} account`}
        />
      )}

      {/* Header with Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{m['dashboard.integrations.github.repository.title']()}</h3>
          <p className="text-xs text-muted-foreground">
            {m['dashboard.integrations.github.repository.select_existing']()}
          </p>
        </div>
        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            size="sm"
            variant="outline"
            className="flex-shrink-0"
          >
            <Plus className="w-3 h-3 mr-1" />
            {m['dashboard.integrations.github.repository.new_button']()}
          </Button>
        )}
      </div>

      {/* Repository List */}
      <div className="space-y-3">
        <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
          {repositories.map((repo) => (
            <button
              key={repo.id}
              type="button"
              className="w-full p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-all duration-200 text-left group"
              onClick={() => onRepositorySelect(repo)}
              aria-label={m['dashboard.integrations.github.repository.select_aria_label']({ name: repo.name })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                      {repo.name}
                    </h4>
                    {repo.private && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        {m['dashboard.integrations.github.repository.private_badge']()}
                      </Badge>
                    )}
                  </div>

                  {repo.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {repo.language && (
                      <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {repo.stargazers_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="w-3 h-3" />
                      {repo.forks_count}
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/70 flex-shrink-0 transition-colors" />
              </div>
            </button>
          ))}
        </div>

        {repositories.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No repositories found</p>
          </div>
        )}
      </div>
    </div>
  )
}
