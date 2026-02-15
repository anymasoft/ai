/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-input-area.tsx
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

import { Textarea } from '@libra/ui/components/textarea'
import { cn } from '@libra/ui/lib/utils'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import * as m from '@/paraglide/messages'
import { useChatInputArea } from '../hooks/use-chat-input-area'
import { SelectedItems } from '../selected-elements'
import {
  getInputContainerStyles,
  getLoadingIndicatorStyles,
  getLoadingSpanStyles,
  getTextareaStyles,
} from '../styles/input-styles'
import type { ChatInputAreaProps } from '../types'
import { isQuotaExceeded } from '../utils/quota-utils'
import { AutoFixButton } from './auto-fix-button'
import { ChatToolbar } from './chat-toolbar'
import { FileUploadPreview } from './file-upload-preview'
import { UpgradeButton } from './upgrade-button'

/**
 * Chat input area component - handles user message input and interaction controls
 */
export const ChatInputArea = ({
  message,
  isSending,
  handleTextareaChange,
  handleSendMessage,
  textareaRef,
  isInspectorActive,
  handleToggleInspector,
  loadingStatus,
  selectedItems = [],
  onRemoveSelectedItem,
  selectedModelId,
  onModelChange,
  onFileUploadSuccess,
  onFileRemoved,
  shouldClearFile,
  onStopGeneration,
  isStopping,
  canStop,
  usageData,
  isUsageLoading,
  detectedErrors,
  onAutoFix,
}: ChatInputAreaProps) => {
  // Use custom hook to extract logic
  const {
    messageLength,
    maxMessageLength,
    isOverLimit,
    handleFormFocus,
    handleFormBlur,
    handleMessageSend,
    handleKeyDown,
    handleInspectorToggle,
    autoResizeTextarea,
    fileInputRef,
    handleFileSelectClick,
    handleFileChange,
    handleRemoveUploadedFile,
    uploadedFileKey,
    uploadedFileName,
    previewImageUrl,
    isUploadingFile,
    uploadError,
    clearFileState,
    isDeletingFile,
  } = useChatInputArea({
    message,
    isSending,
    handleSendMessage,
    textareaRef,
    handleToggleInspector,
    isInspectorActive,
    onFileUploadSuccess: onFileUploadSuccess || (() => {}),
    onFileRemoved: onFileRemoved || (() => {}),
  })

  // Adjust height when message content changes
  useEffect(() => {
    autoResizeTextarea()
  }, [autoResizeTextarea])

  // Handle externally triggered file state clearing
  useEffect(() => {
    if (shouldClearFile) {
      clearFileState()
      onFileRemoved?.()
    }
  }, [shouldClearFile, clearFileState, onFileRemoved])

  // Handle message change for Spark enhancement
  const handleMessageChange = (newMessage: string) => {
    // Create a synthetic event to match the expected signature
    const syntheticEvent = {
      target: { value: newMessage },
    } as React.ChangeEvent<HTMLTextAreaElement>
    handleTextareaChange(syntheticEvent)
  }

  // Check if quota is exceeded
  const quotaExceeded = isQuotaExceeded(usageData)

  return (
    <div className='w-full pb-3 sm:pb-4 pt-2'>
      {/* Hidden File Input */}
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept='image/*'
        disabled={isUploadingFile || isDeletingFile || isSending}
      />

      {/* Selected elements display area */}
      {selectedItems?.length > 0 && (
        <div className='mb-3 animate-in fade-in-50 slide-in-from-top-2 duration-300'>
          <SelectedItems items={selectedItems} onRemove={onRemoveSelectedItem || (() => {})} />
        </div>
      )}

      {/* Loading status indicator */}
      {loadingStatus && (
        <div className={getLoadingIndicatorStyles()}>
          <span className={getLoadingSpanStyles()}>
            <Loader2 className='h-3.5 w-3.5 animate-spin text-accent dark:text-blue-400' />
            <span className='font-medium'>{loadingStatus}</span>
          </span>
        </div>
      )}

      {/* File upload preview */}
      <FileUploadPreview
        previewImageUrl={previewImageUrl}
        uploadedFileName={uploadedFileName}
        isUploadingFile={isUploadingFile}
        isDeletingFile={isDeletingFile}
        uploadError={uploadError}
        isSending={isSending}
        onRemoveFile={handleRemoveUploadedFile}
      />

      {/* Auto Fix button when errors are detected */}
      <AutoFixButton
        detectedErrors={detectedErrors || []}
        onAutoFix={onAutoFix || (() => {})}
        quotaExceeded={quotaExceeded}
      />

      {/* Upgrade button when quota is exceeded */}
      {quotaExceeded && (
        <div className='mb-3 animate-in fade-in-50 slide-in-from-top-2 duration-300'>
          <UpgradeButton />
        </div>
      )}

      {/* Main input container */}
      <div className={getInputContainerStyles()}>
        <form onSubmit={handleMessageSend} className='flex flex-col overflow-hidden w-full'>
          {/* Text input area with character count */}
          <div className='p-3 flex-grow transition-all duration-200 relative'>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFormFocus}
              onBlur={handleFormBlur}
              placeholder={quotaExceeded ? m['chatPanel.input.placeholderQuotaExceeded']() : m['chatPanel.input.placeholder']()}
              maxLength={maxMessageLength}
              rows={1}
              disabled={isSending || quotaExceeded}
              className={getTextareaStyles()}
              aria-label={m['chatPanel.input.chatInputLabel']()}
            />

            {/* Character count hint - positioned in top right corner */}
            {messageLength > maxMessageLength * 0.8 && (
              <div
                className={cn(
                  'absolute top-2 right-2 text-xs px-2 py-1 rounded-md transition-colors pointer-events-none',
                  'backdrop-blur-sm border',
                  messageLength > maxMessageLength
                    ? 'dark:text-red-400 text-red-500 font-medium dark:bg-red-900/20 bg-red-50 dark:border-red-700 border-red-200'
                    : messageLength > maxMessageLength * 0.9
                      ? 'dark:text-amber-400 text-amber-500 dark:bg-amber-900/20 bg-amber-50 dark:border-amber-700 border-amber-200'
                      : 'dark:text-neutral-400 text-gray-500 dark:bg-neutral-800/50 bg-gray-50 dark:border-neutral-700 border-gray-200'
                )}
              >
                {m['chatPanel.input.characterCount']({ current: messageLength, max: maxMessageLength })}
              </div>
            )}
          </div>

          {/* Toolbar */}
          <ChatToolbar
            {...(selectedModelId !== undefined && { selectedModelId })}
            {...(onModelChange !== undefined && { onModelChange })}
            isInspectorActive={isInspectorActive}
            onInspectorToggle={handleInspectorToggle}
            isUploadingFile={isUploadingFile}
            isDeletingFile={isDeletingFile}
            onFileSelectClick={handleFileSelectClick}
            messageLength={messageLength}
            uploadedFileKey={uploadedFileKey}
            isOverLimit={isOverLimit}
            isSending={isSending}
            onSend={handleMessageSend}
            {...(onStopGeneration !== undefined && { onStopGeneration })}
            {...(isStopping !== undefined && { isStopping })}
            {...(canStop !== undefined && { canStop })}
            message={message}
            onMessageChange={handleMessageChange}
            {...(usageData !== undefined && { usageData })}
            {...(isUsageLoading !== undefined && { isUsageLoading })}
            quotaExceeded={quotaExceeded}
          />
        </form>
      </div>
    </div>
  )
}
