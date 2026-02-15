/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * url-display-card.tsx
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

import { Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import { useOptimizedClipboard, useMemoizedMessages } from './hooks/use-performance-optimization'
import * as m from '@/paraglide/messages'

interface UrlDisplayCardProps {
  url: string
  title?: string
  className?: string
  hideHeader?: boolean
}

export function UrlDisplayCard({
  url,
  title,
  className,
  hideHeader = false
}: UrlDisplayCardProps) {
  // Use optimized clipboard hook
  const { copyToClipboard, isCopied } = useOptimizedClipboard()

  // Memoize localized messages for better performance
  const messages = useMemoizedMessages([
    'ide.deployment.dialog.deploymentUrl',
    'ide.deployment.dialog.copy',
    'ide.deployment.dialog.copied',
    'ide.deployment.dialog.open',
    'ide.deployment.dialog.active'
  ])

  // Use memoized values
  const displayTitle = title || messages['ide.deployment.dialog.deploymentUrl']
  const copiedUrl = isCopied('url')

  const handleCopyUrl = async (urlToCopy: string) => {
    await copyToClipboard(urlToCopy, 'url')
  }

  return (
    <div className={cn("space-y-4", className)}>
      {!hideHeader && (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-brand/5 to-transparent rounded-2xl" />
          <div className="relative glass-2 rounded-2xl p-6 border border-border/50 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-brand/20 flex items-center justify-center border border-primary/30">
                  <ExternalLink className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-foreground">
                    {displayTitle}
                  </h4>
                  <p className="text-xs text-muted-foreground">{m["ide.deployment.success.liveUrlTitle"]()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL display with actions */}
      <div className="glass-1 rounded-xl border border-border/30 overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 group flex items-center gap-3 min-w-0"
            >
              <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse flex-shrink-0" />
              <span className="text-sm font-mono text-foreground/90 truncate group-hover:text-primary transition-colors duration-200">
                {url}
              </span>
            </a>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyUrl(url)}
                className={cn(
                  "h-8 px-3 text-xs font-medium transition-all duration-200",
                  copiedUrl && "text-green-600 dark:text-green-400"
                )}
              >
                {copiedUrl ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 px-3 text-xs font-medium"
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Status bar */}
        <div className="bg-muted/30 px-4 py-2 border-t border-border/30">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground font-medium">{m["ide.deployment.urlStatus.liveOnline"]()}</span>
            </div>
            <span className="text-muted-foreground">{m["ide.deployment.urlStatus.sslEnabled"]()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
