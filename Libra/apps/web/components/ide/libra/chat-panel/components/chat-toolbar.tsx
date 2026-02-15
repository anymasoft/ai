/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-toolbar.tsx
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

import { useMutation } from '@tanstack/react-query'
import { ArrowUp, Loader2, Paperclip, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { Button } from '@libra/ui/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@libra/ui/components/tooltip'
import { cn } from '@libra/ui/lib/utils'

import { ModelSelector } from './model-selector'
import { ElementSelector } from './element-selector'
import type { UsageData } from '../utils/quota-utils'

interface ChatToolbarProps {
  // Model selection related
  selectedModelId?: string
  onModelChange?: (modelId: string) => void

  // Inspector related
  isInspectorActive: boolean
  onInspectorToggle: () => void
  selectedElementsCount?: number

  // File upload related
  isUploadingFile: boolean
  isDeletingFile?: boolean
  onFileSelectClick: () => void

  // Send button related
  messageLength: number
  uploadedFileKey?: string | null
  isOverLimit: boolean
  isSending: boolean
  onSend: (e: React.MouseEvent<HTMLButtonElement>) => void

  // Stop functionality related
  onStopGeneration?: () => void
  isStopping?: boolean
  canStop?: boolean

  // Spark enhancement related
  message: string
  onMessageChange: (message: string) => void

  // Usage data related
  usageData?: UsageData | null
  isUsageLoading?: boolean

  // Quota status
  quotaExceeded?: boolean
}

export const ChatToolbar = ({
  selectedModelId,
  onModelChange,
  isInspectorActive,
  onInspectorToggle,
  selectedElementsCount = 0,
  isUploadingFile,
  isDeletingFile = false,
  onFileSelectClick,
  messageLength,
  uploadedFileKey,
  isOverLimit,
  isSending,
  onSend,
  onStopGeneration,
  isStopping,
  canStop,
  message,
  onMessageChange,
  usageData,
  isUsageLoading,
  quotaExceeded = false,
}: ChatToolbarProps) => {
  const trpc = useTRPC()
  const canSend =
    (messageLength > 0 || uploadedFileKey) && !isOverLimit && !isSending && !quotaExceeded

  // Spark enhancement mutation
  const enhancePromptMutation = useMutation(
    trpc.ai.generateText.mutationOptions({
      onSuccess: (data) => {
        onMessageChange(data.text)
        toast.success(m['chatPanel.notifications.promptEnhanced']())
      },
      onError: (err) => {
        const code = err.data?.code
        if (code === 'UNAUTHORIZED') {
          toast.error(m['chatPanel.notifications.loginRequired']())
        } else {
          toast.error(m['chatPanel.notifications.enhanceFailed']())
        }
      },
    })
  )

  // Check if Spark button should be disabled
  const canEnhance =
    message.trim().length > 0 && !enhancePromptMutation.isPending && !isSending && !quotaExceeded

  // Handle Spark button click
  const handleSparkClick = () => {
    if (!canEnhance) return

    enhancePromptMutation.mutate({
      prompt: message,
    })
  }

  // Handle Inspector toggle with quota check
  const handleInspectorToggle = () => {
    if (quotaExceeded) {
      toast.error(m['chatPanel.toolbar.quotaExceededElementSelection']())
      return
    }
    onInspectorToggle()
  }

  // Handle File upload with quota check
  const handleFileUpload = () => {
    if (quotaExceeded) {
      toast.error(m['chatPanel.toolbar.quotaExceededFileUpload']())
      return
    }
    onFileSelectClick()
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2',
        'transition-all duration-300',
        'group-focus-within:bg-gradient-to-br group-focus-within:from-background/80 group-focus-within:to-background/60'
      )}
    >
      {/* Left: Model Selector */}
      <ModelSelector
        {...(selectedModelId && { selectedModelId })}
        {...(onModelChange && { onModelChange })}
        {...(usageData && { usageData })}
        {...(isUsageLoading !== undefined && { isUsageLoading })}
      />

      {/* Center: Element Selector */}
      <ElementSelector
        isActive={isInspectorActive}
        selectedCount={selectedElementsCount}
        onToggle={handleInspectorToggle}
        quotaExceeded={quotaExceeded}
      />

      {/* Right: Action Buttons */}
      <div className='flex items-center gap-1.5'>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={handleSparkClick}
              disabled={!canEnhance}
              className={cn(
                'p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2',
                canEnhance
                  ? 'dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-700 dark:focus-visible:ring-blue-500 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-400'
                  : 'dark:text-neutral-600 text-gray-400 cursor-not-allowed opacity-50'
              )}
              aria-label={m['chatPanel.toolbar.enhance_prompt']()}
            >
              {enhancePromptMutation.isPending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Sparkles className='h-4 w-4' />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side='top'>{m['chatPanel.toolbar.enhance_prompt']()}</TooltipContent>
        </Tooltip>

        {/* File Upload Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={handleFileUpload}
              disabled={isUploadingFile || isDeletingFile || isSending || quotaExceeded}
              className={cn(
                'p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2',
                // Normal state
                !quotaExceeded && !isUploadingFile && !isDeletingFile && !isSending && [
                  'dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-700 dark:focus-visible:ring-blue-500',
                  'text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-400'
                ],
                // Disabled state
                (isUploadingFile || isDeletingFile || isSending || quotaExceeded) && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={
                quotaExceeded
                  ? m['chatPanel.toolbar.quotaExceededFileUploadShort']()
                  : m['chatPanel.toolbar.file_upload']()
              }
            >
              {(isUploadingFile || isDeletingFile) ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Paperclip className='h-4 w-4' />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side='top'>
            {quotaExceeded
              ? m['chatPanel.toolbar.quotaExceededFileUpload']()
              : m['chatPanel.toolbar.file_upload']()
            }
          </TooltipContent>
        </Tooltip>

        {/* Stop Generation Button - Show when AI is generating and can be stopped */}
        {canStop && (
          <Button
            type='button'
            onClick={onStopGeneration}
            disabled={isStopping}
            size='icon'
            variant='outline'
            className={cn(
              'ml-1 transition-all duration-200 transform active:scale-95 rounded-md',
              'focus-visible:ring-offset-2',
              'dark:focus-visible:ring-offset-neutral-800 focus-visible:ring-offset-white',
              isStopping
                ? 'dark:bg-neutral-700 dark:text-neutral-400 bg-gray-200 text-gray-400'
                : 'dark:bg-red-600 dark:hover:bg-red-700 dark:focus-visible:ring-red-500 dark:text-white bg-red-500 hover:bg-red-600 focus-visible:ring-red-400 text-white border-red-500 dark:border-red-600'
            )}
            aria-label={m['chatPanel.toolbar.stop_generation']()}
          >
            {isStopping ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <div className='h-4 w-4 bg-current rounded-sm' />
            )}
          </Button>
        )}

        {/* Send Button */}
        <Button
          type='submit'
          onClick={onSend}
          disabled={!canSend}
          size='icon'
          className={cn(
            'ml-2 transition-all duration-200 transform active:scale-95 rounded-md',
            'focus-visible:ring-offset-2',
            canSend ? 'shadow-sm' : 'cursor-not-allowed',
            'dark:focus-visible:ring-offset-neutral-800 focus-visible:ring-offset-white',
            canSend
              ? 'dark:bg-green-600 dark:hover:bg-green-700 dark:focus-visible:ring-green-500 dark:text-white'
              : 'dark:bg-neutral-700 dark:text-neutral-400',
            canSend
              ? 'bg-green-500 hover:bg-green-600 focus-visible:ring-green-400 text-white'
              : 'bg-gray-200 text-gray-400'
          )}
          aria-label={m['chatPanel.toolbar.send_message']()}
        >
          {isSending ? (
            <Loader2 className='h-5 w-5 animate-spin' />
          ) : (
            <ArrowUp className='h-5 w-5' />
          )}
        </Button>
      </div>
    </div>
  )
}
