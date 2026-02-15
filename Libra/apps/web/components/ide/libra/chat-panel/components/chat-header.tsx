/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-header.tsx
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

import * as m from '@/paraglide/messages'
import { X, Maximize2, Minimize2, MessageSquare, Book } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import { useState, useCallback, useRef, useEffect } from 'react'

interface ChatHeaderProps {
  onClose: () => void
}

/**
 * Chat panel header component
 * Provides close, maximize/minimize control functions, and basic help information
 */
export function ChatHeader({ onClose }: ChatHeaderProps) {
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  
  const togglePanelSize = () => {
    setIsPanelExpanded(!isPanelExpanded);
    // In actual application, this can trigger logic to adjust chat panel size
    // For example, send events to parent component to change layout
  };
  
  return (
    <div className="flex justify-between items-center h-16 px-6 border-b border-border/50 bg-gradient-to-r from-background to-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20">
          <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {m["chatPanel.header.title"]()}
        </h2>
      </div>
      
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={togglePanelSize}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                   transition-all duration-200"
          aria-label={isPanelExpanded ? m["chatPanel.header.collapsePanel"]() : m["chatPanel.header.expandPanel"]()}
        >
          {isPanelExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        
        <button
          type="button"
          onClick={() => {
            onClose();
          }}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                   transition-all duration-200 ml-1"
          aria-label={m["chatPanel.header.closePanel"]()}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
} 