/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * new-message-indicator.tsx
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
import { ArrowDown } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'

interface NewMessageIndicatorProps {
  hasNewMessages: boolean
  unreadCount: number
  onScrollToBottom: () => void
}

/**
 * New message indicator - shows new message notification when user hasn't scrolled to bottom
 */
export const NewMessageIndicator = ({
  hasNewMessages,
  unreadCount,
  onScrollToBottom
}: NewMessageIndicatorProps) => {
  if (!hasNewMessages) return null;
  
  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none z-10">
      <button
        type="button"
        onClick={() => {
          onScrollToBottom();
        }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "bg-accent text-accent-fg shadow-md",
          "pointer-events-auto hover:bg-accent-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
        )}
        aria-label={m["chatPanel.newMessage.viewNewMessages"]()}
      >
        <ArrowDown className="h-4 w-4" />
        <span className="text-sm font-medium">
          {unreadCount > 1 ? m["chatPanel.newMessage.newMessages"]({ count: unreadCount }) : m["chatPanel.newMessage.newMessage"]()}
        </span>
      </button>
    </div>
  )
} 