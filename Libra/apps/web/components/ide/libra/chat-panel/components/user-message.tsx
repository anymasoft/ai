/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * user-message.tsx
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
import { memo, useCallback, useState } from 'react'
import type { MessageGroup } from './types'
import Image from 'next/image'
import { getCdnImageUrl } from '@libra/common'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@libra/ui/components/dialog'

interface ExtendedMessage {
  id?: string;
  content?: string;
  message?: string;
  type?: string;
  attachment?: {
    key: string;
    name: string;
    type: string;
  };
  [key: string]: any;
}

const buildImageUrl = (key: string): string => {
  return getCdnImageUrl(key);
}

const ImageAttachment = memo(({ attachment }: { attachment: { key: string; name: string; type: string } }) => {
  const imageUrl = buildImageUrl(attachment.key)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  
  const handleImageClick = useCallback(() => {
    setIsPreviewOpen(true)
  }, [])

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false)
  }, [])

  return (
    <>
      <div className='mt-2 w-[240px] h-[160px] rounded-lg overflow-hidden border border-border/60 bg-card/20 shadow-sm hover:shadow-md transition-shadow duration-200'>
        <Image
          src={imageUrl}
          alt={attachment.name}
          width={240}
          height={160}
          className='w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity duration-200'
          onClick={handleImageClick}
          onError={(e) => {
          }}
        />
        <div className='px-3 py-1.5 text-xs text-fg-subtle bg-card/40 border-t border-border/40'>
          <span className='truncate block'>{attachment.name}</span>
        </div>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className='max-w-4xl max-h-[90vh] p-0 overflow-hidden'
          aria-labelledby="image-preview-title"
        >
          {/* Accessibility hidden title, ensuring DialogContent direct child has DialogTitle */}
          <DialogTitle id="image-preview-title" className="sr-only">
            {attachment.name}
          </DialogTitle>
          <DialogHeader className='p-6 pb-2'>
            <DialogTitle className='text-lg font-medium truncate'>
              {attachment.name}
            </DialogTitle>
          </DialogHeader>
          <div className='px-6 pb-6'>
            <div className='relative w-full max-h-[70vh] overflow-hidden rounded-lg bg-muted/20'>
              <Image
                src={imageUrl}
                alt={attachment.name}
                width={800}
                height={600}
                className='w-full h-auto max-h-[70vh] object-contain'
                onError={(e) => {
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
ImageAttachment.displayName = 'ImageAttachment'

interface UserMessageProps {
  group: MessageGroup; 
  index: number; 
  isLastGroup: boolean;
  selectedItems: any[];
  removeSelectedItem: (index: number) => void;
}

const UserMessageComponent = memo(({ 
  group, 
  index, 
  isLastGroup,
  selectedItems,
  removeSelectedItem
}: UserMessageProps) => {
  if (!group.messages || group.messages.length === 0) {
    return null;
  }

  const message = group.messages[0] as ExtendedMessage;
  let messageContent = '';
  
  if (message) {
    if (typeof message.content === 'string') {
      messageContent = message.content;
    } else if (typeof message.message === 'string') {
      messageContent = message.message;
    }
  }

  const isPendingMessage = message && message.id === 'pending-user-message';
  const hasImageAttachment = message?.attachment?.type?.startsWith('image/')

  return (
    <div className='flex flex-col items-end w-full animate-in fade-in duration-300' aria-label='User message'>
      <div className={cn('max-w-[90%] px-3 py-2 rounded-lg border bg-primary text-primary-foreground shadow-sm')}>
        <div className='whitespace-pre-wrap break-words text-sm leading-relaxed'>
          {messageContent}
        </div>
      </div>

      {hasImageAttachment && message.attachment && (
        <div className='mt-1.5 max-w-[90%] flex justify-end'>
          <ImageAttachment attachment={message.attachment} />
        </div>
      )}

      {isLastGroup && isPendingMessage && selectedItems.length > 0 && (
        <div className={cn('max-w-[90%] mt-1.5', 'bg-card/30 border border-border rounded-lg', 'animate-in slide-in-from-right-1 fade-in duration-300 delay-100')}>
          <div className='flex items-center text-xs text-fg-muted px-2.5 py-1.5 gap-1.5'>
            <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
              <path d='M3 14l9 6 9-6M3 8l9 6 9-6M3 2l9 6 9-6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
            <span className='font-medium'>Reference Elements</span>
          </div>
          <div className='flex flex-wrap gap-2 px-2.5 pb-2.5'>
            {selectedItems.map((item, idx) => (
              <div key={`ref-${idx}`} className={cn('flex items-center px-2 py-1 rounded-md text-xs gap-1', 'border border-border bg-card/70', 'hover:border-border-hover transition-colors duration-200 shadow-sm')}>
                <span className='truncate max-w-[150px] text-fg font-medium'>
                  {item.name || item.path || 'Unnamed element'}
                </span>
                <button
                  type='button'
                  onClick={() => {
                    removeSelectedItem(idx)
                  }}
                  className={cn('text-fg-muted hover:text-error transition-colors duration-200 ml-0.5', 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', 'focus-visible:ring-offset-0 rounded-full')}
                  aria-label={`Remove reference element ${item.name || item.path || 'Unnamed element'}`}
                >
                  <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
                    <path d='M18 6L6 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                    <path d='M6 6L18 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
UserMessageComponent.displayName = 'UserMessageComponent';

export { UserMessageComponent }; 