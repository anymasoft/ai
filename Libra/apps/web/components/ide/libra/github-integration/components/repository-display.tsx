/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * repository-display.tsx
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

import { useState } from 'react'
import { Button } from '@libra/ui/components/button'
import { Badge } from '@libra/ui/components/badge'
import { Copy, Check, ExternalLink, Star, GitFork, GitBranch } from 'lucide-react'
import Github from '@/components/logos/github'
import { cn } from '@libra/ui/lib/utils'
import type { GitHubRepository } from '../types'
import * as m from '@/paraglide/messages'

interface RepositoryDisplayProps {
  repository?: GitHubRepository
  repositoryUrl?: string
  showCopyButton?: boolean
  showStats?: boolean
  showDescription?: boolean
  className?: string
}

export function RepositoryDisplay({
  repository,
  repositoryUrl,
  showCopyButton = false,
  showStats = false,
  showDescription = true,
  className
}: RepositoryDisplayProps) {
  const [isCopied, setIsCopied] = useState(false)

  const url = repositoryUrl || repository?.html_url
  const name = repository?.name || 'Repository'
  const description = repository?.description
  const isPrivate = repository?.private

  const handleCopyUrl = async () => {
    if (url) {
      try {
        await navigator.clipboard.writeText(url)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      } catch (error) {
      }
    }
  }

  if (!repository && !repositoryUrl) {
    return null
  }

  return (
    <div className={cn('p-3 bg-muted/50 rounded-lg border', className)}>
      {repository ? (
        <div className="space-y-2">
          {/* Repository header */}
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{name}</span>
            {isPrivate && (
              <Badge variant="secondary" className="text-xs">{m['dashboard.integrations.github.repository_display.private_badge']()}</Badge>
            )}
          </div>

          {/* Description */}
          {showDescription && description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}

          {/* Stats */}
          {showStats && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {repository.language && (
                <span className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {repository.language}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star className="w-2.5 h-2.5" />
                {repository.stargazers_count}
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="w-2.5 h-2.5" />
                {repository.forks_count}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Simple URL display */
        <div className="flex items-center gap-2">
          <Github className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="font-mono flex-1 truncate text-foreground text-xs">
            {url}
          </span>
        </div>
      )}

      {/* Copy button */}
      {showCopyButton && url && (
        <div className="flex items-center justify-end mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopyUrl}
            title={isCopied ? m['dashboard.integrations.github.repository_display.copied_tooltip']() : m['dashboard.integrations.github.repository_display.copy_tooltip']()}
          >
            {isCopied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
