/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * message-dialog.tsx
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

import { X } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import { Button } from '@libra/ui/components/button'
import * as m from '@/paraglide/messages'

interface MessageDialogProps {
  messages: Array<{
    timestamp: string;
    type: string;
    data: any;
  }>;
  onClose?: () => void;
  className?: string;
}

export const MessageDialog = ({ messages, onClose, className }: MessageDialogProps) => {
  return (
    <div className={cn(
      "flex flex-col max-h-[500px]  border border-border-default rounded-lg shadow-md overflow-hidden",
      "dark:-subtle dark:border-border-emphasis dark:shadow-2xl",
      className
    )}>
      <div className="flex items-center justify-between p-3 border-b border-border-subtle dark:border-border-emphasis -subtle dark:-emphasis">
        <h3 className="text-base font-medium text-fg-default dark:text-fg-default">{m["browserPreview.messageDialog.title"]()}</h3>
        {onClose && (
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full text-fg-muted hover:text-fg-default hover:-emphasis dark:text-fg-muted dark:hover:text-fg-default dark:hover:-emphasis"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="overflow-y-auto flex-1 p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full -subtle dark:-emphasis flex items-center justify-center mb-3">
              <AlertCircle className="h-6 w-6 text-fg-muted dark:text-fg-muted" />
            </div>
            <p className="text-fg-muted dark:text-fg-muted text-sm">{m["browserPreview.messageDialog.noMessages"]()}</p>
            <p className="text-xs text-fg-subtle dark:text-fg-subtle mt-1">{m["browserPreview.messageDialog.noMessagesHelper"]()}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className="border border-border-default dark:border-border-emphasis rounded-md overflow-hidden"
              >
                <div className="flex justify-between items-center px-3 py-2 -subtle dark:-emphasis border-b border-border-subtle dark:border-border-emphasis">
                  <span className="font-medium text-sm text-fg-default dark:text-fg-default">{msg.type}</span>
                  <span className="text-xs text-fg-muted dark:text-fg-muted  dark:-subtle px-2 py-0.5 rounded-full">
                    {msg.timestamp}
                  </span>
                </div>
                <div className="p-3">
                  <pre className=" dark:-subtle p-2 rounded text-xs overflow-x-auto font-mono text-fg-default dark:text-fg-default whitespace-pre-wrap">
                    {JSON.stringify(msg.data, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 