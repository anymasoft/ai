/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * url-preview.tsx
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
import { useState } from 'react'
import * as m from '@/paraglide/messages'
export type UrlStatus = 'preview' | 'live' | 'error'

interface UrlPreviewProps {
  url: string
  status: UrlStatus
  showActions?: boolean
  className?: string
}



export function UrlPreview({
  url,
  status,
  showActions = true,
  className
}: UrlPreviewProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Handle copy error silently
    }
  }

  return (
    <div
      className={cn(
        'deployment-card-enhanced transition-all duration-300 border',
        className
      )}
      style={{
        padding: 'var(--deployment-space-md)',
        borderRadius: 'var(--deployment-radius-md)',
      }}
    >


      {/* Simplified URL display */}
      <div className="flex items-center justify-between gap-3">
        <a
          href={status === 'live' ? url : undefined}
          target={status === 'live' ? '_blank' : undefined}
          rel={status === 'live' ? 'noopener noreferrer' : undefined}
          className={cn(
            'flex-1 group flex items-center gap-3 min-w-0 p-3 rounded-md',
            'bg-muted/30 hover:bg-muted/50 transition-all duration-200',
            status === 'live' && 'cursor-pointer hover:text-primary'
          )}
          aria-label={status === 'live' ? m["ide.deployment.urlPreview.openWebsite"]({url}) : m["ide.deployment.urlPreview.previewAddress"]({url})}
        >
          <span className={cn(
            'deployment-text-body font-mono text-foreground/90 truncate',
            status === 'live' && 'group-hover:text-primary transition-colors duration-200'
          )}>
            {url}
          </span>
          {status === 'live' && (
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
          )}
        </a>

        {showActions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={cn(
              'h-10 px-4 font-medium transition-all',
              'hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary',
              copied && 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20'
            )}
            aria-label={copied ? m["ide.deployment.urlPreview.copiedToClipboard"]() : m["ide.deployment.urlPreview.copyLinkToClipboard"]()}
            aria-live="polite"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                <span>{m["ide.deployment.dialog.copied"]()}</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                <span>{m["ide.deployment.dialog.copy"]()}</span>
              </>
            )}
          </Button>
        )}
      </div>


    </div>
  )
}
