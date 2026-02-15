/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * selected-elements.tsx
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

import { cn } from '@libra/ui/lib/utils'
import { Code, Component, FileText, X } from 'lucide-react'
import type React from 'react'
import * as m from '@/paraglide/messages'
import type { IframeInfoItem } from './types'

interface SelectedItemsProps {
  items: IframeInfoItem[]
  onRemove: (index: number) => void
  className?: string
  compact?: boolean
}

/**
 * Selected elements display component
 * Used to display elements selected by users through the selector in chat
 */
export const SelectedItems: React.FC<SelectedItemsProps> = ({
  items,
  onRemove,
  className,
  compact = false,
}) => {
  // Get icon for element type
  const getTypeIcon = (item: IframeInfoItem) => {
    const type = item.type?.toLowerCase() || ''

    if (type.includes('file') || type.includes('path')) {
      return <FileText className='h-3.5 w-3.5 text-accent' />
    }
    if (type.includes('code') || type.includes('function')) {
      return <Code className='h-3.5 w-3.5 text-blue-500' />
    }
    return <Component className='h-3.5 w-3.5 text-green-500' />
  }

  // Get display name for element
  const getDisplayName = (item: IframeInfoItem) => {
    return item.name || item.path || item['selector'] || item.id || 'Unnamed element'
  }

  if (items.length === 0) {
    return null
  }

  // Log selected element information
  console.log('[SelectedItems] Rendering selected elements:', {
    count: items.length,
    types: items.map((item) => item.type || 'unknown'),
  })

  return (
    <div className={cn('w-full', compact ? 'mb-2' : '', className)}>
      {!compact && (
        <div className='flex justify-between items-center mb-2'>
          <div className='flex items-center text-fg'>
            <FileText className='h-3.5 w-3.5 mr-1.5 text-accent' />
            <span className='text-xs font-medium'>{m['chatPanel.selectedElements.title']()}</span>
            <span className='ml-1.5 bg-accent/10 text-accent text-[10px] px-1.5 py-0.5 rounded-full ring-1 ring-accent/20'>
              {items.length}
            </span>
          </div>
          {items.length > 1 && (
            <button
              type='button'
              onClick={() => {
                // Clear all selected elements
                console.log('[SelectedItems] Clearing all selected elements')
                for (const item of items) {
                  onRemove(0)
                } // Always remove the first one as array changes dynamically
              }}
              className='text-xs text-fg-muted hover:text-destructive transition-colors px-2 py-0.5 rounded hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            >
              {m['chatPanel.selectedElements.clearAll']()}
            </button>
          )}
        </div>
      )}

      <div className={cn('flex flex-wrap gap-2', compact ? '' : '')}>
        {items.map((item, index) => (
          <div
            key={`item-${
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              index
            }`}
            className='flex items-center gap-1.5 text-xs rounded-md px-2 py-1 
                     bg-muted/20 ring-1 ring-border/60 hover:ring-muted-foreground/40
                     transition-all duration-200'
          >
            {!compact && getTypeIcon(item)}
            <span className='truncate max-w-[120px]'>{getDisplayName(item)}</span>
            <button
              type='button'
              onClick={() => {
                console.log('[SelectedItems] Removing element:', index)
                onRemove(index)
              }}
              className='text-fg-muted hover:text-error transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full'
              aria-label={m['chatPanel.selectedElements.removeElement']({
                name: getDisplayName(item),
              })}
            >
              <X className='h-3 w-3' />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
