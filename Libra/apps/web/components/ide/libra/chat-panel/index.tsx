/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as m from '@/paraglide/messages'
import { ChatInputArea } from './components/chat-input-area'
import { ElementEditorPanel } from './components/element-editor-panel'
import { MessageList } from './components/message-list'
import { NewMessageIndicator } from './components/new-message-indicator'
import { useChatFunctions } from './hooks/use-chat-functions'
import { useChatPanelEnhanced as useChatPanel } from './hooks/use-chat-panel-enhanced'
import { useIframeMessages } from './hooks/use-iframe-messages'
import { useUiHelpers } from './hooks/use-ui-helpers'
import type { ChatPanelProps, MessageListProps } from './types'

/**
 * Chat panel component - main entry component
 * Responsible for managing chat interface, message display and interaction functionality
 */
export default function ChatPanel({
  initialMessages,
  onInspectorChange,
  initialInspectorActive = false,
  browserPreviewRef,
  onFileClick,
  onFileContentUpdate,
  deployChanges,
  usageData,
  isUsageLoading,
  detectedErrors: externalDetectedErrors = [],
  chatPanelRef,
}: ChatPanelProps) {
  // Basic references
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Initial message sent flag - use useRef to avoid React 18 Strict Mode duplicate calls
  const initialMessageSentRef = useRef(false)

  // State for uploaded file details and PlanId
  const [uploadedFileDetails, setUploadedFileDetails] = useState<{
    key: string
    name: string
    type: string
  } | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)

  // Add file clearing trigger flag
  const [shouldClearFile, setShouldClearFile] = useState(false)

  // State for selected AI model
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined)

  // State for error monitoring
  const [internalDetectedErrors, setInternalDetectedErrors] = useState<
    Array<{
      message: string
      filename?: string
      lineno?: number
      colno?: number
      stack?: string
      blankScreen?: boolean
    }>
  >([])
  const [isAutoFixing, setIsAutoFixing] = useState(false)

  // Merge external and internal detected errors
  const detectedErrors = useMemo(() => {
    const combined = [...externalDetectedErrors, ...internalDetectedErrors]
    // Remove duplicates based on message, filename, and line number
    const unique = combined.filter(
      (error, index, arr) =>
        arr.findIndex(
          (e) =>
            e.message === error.message &&
            e.filename === error.filename &&
            e.lineno === error.lineno
        ) === index
    )
    // Keep only the latest 10 errors
    return unique.slice(0, 10)
  }, [externalDetectedErrors, internalDetectedErrors])

  // Custom hooks
  const {
    messages,
    isLoading,
    sendMessageToAI,
    loading,
    revertHistory,
    sendInitialMessageToAI,
    stopGeneration,
    isStopping,
    canStop,
    addMessage,
  } = useChatFunctions(
    initialMessages || [],
    onFileContentUpdate,
    {
      sendDefaultThinkingMessage: false,
    },
    deployChanges,
    selectedModelId
  )

  const {
    selectedItems,
    isInspectorActive,
    removeSelectedItem,
    handleToggleInspector,
    editingState,
    updateElementProperty,
    applyElementChanges,
    cancelElementChanges,
    deleteElement,
    closeElementEditor,
  } = useIframeMessages({
    onInspectorChange,
    initialInspectorActive,
    browserPreviewRef,
  })

  const { adjustTextareaHeight } = useUiHelpers({
    textareaRef,
    scrollAreaRef,
  })

  // Chat panel state and logic
  // Scroll trigger callback
  const handleScrollTrigger = useCallback((triggerType: string) => {
    // Scroll trigger handling
  }, [])

  const {
    message,
    isSending,
    hasNewMessages,
    unreadCount,
    setMessage,
    setIsSending,
    handleTextareaChange,
    handleScroll,
    scrollToBottomWithType,
    handleScrollToBottomClick,
    groupedMessages,
  } = useChatPanel({
    messages,
    onFileClick,
    textareaRef,
    scrollAreaRef,
    messagesEndRef,
    adjustTextareaHeight,
    onScrollTrigger: handleScrollTrigger,
  })

  // Content height change callback - modified to use smart scroll for new content only
  const handleContentHeightChange = useCallback(() => {
    // Only trigger scroll for genuine new content, not tab switches
    // The smart scroll system will decide whether to scroll based on user interaction
    if (scrollToBottomWithType) {
      scrollToBottomWithType('content_change')
    }
  }, [scrollToBottomWithType])

  // Expose addMessage function through ref
  useEffect(() => {
    if (chatPanelRef) {
      chatPanelRef.current = {
        addMessage,
      }
    }
  }, [chatPanelRef, addMessage])

  // Streaming message scroll callbacks (removed unused scrollCallbacks)

  // Check if initial message needs to be sent automatically - use useRef to avoid React 18 Strict Mode duplicate calls
  useEffect(() => {
    if (
      Array.isArray(initialMessages) &&
      initialMessages.length === 1 &&
      !isLoading &&
      !initialMessageSentRef.current
    ) {
      const initialContent = initialMessages[0]
      // Extract attachment data from the initial message
      const attachmentData =
        (initialContent as unknown as { attachment?: { key: string; name: string; type: string } })
          ?.attachment || null

      sendInitialMessageToAI(initialContent, selectedItems, attachmentData)
      initialMessageSentRef.current = true
    }
  }, [initialMessages, isLoading, selectedItems, sendInitialMessageToAI])

  // Handle message sending
  const handleSendMessage = async (
    e: React.FormEvent,
    fileDetails?: { key: string; name: string; type: string } | null,
    providedPlanId?: string
  ) => {
    e.preventDefault()
    const content = message.trim()

    // Fix: prioritize file info from component state, use parameter as fallback
    const actualFileDetails = uploadedFileDetails || fileDetails
    const planIdToUse = providedPlanId || currentPlanId

    // Fix sending condition: can send as long as there's content or file
    if ((!content && !actualFileDetails) || isSending) {
      return
    }

    // Immediately clear input content and adjust height
    setMessage('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Set sending state to true
    setIsSending(true)

    // Scroll to bottom immediately after user sends message
    if (scrollToBottomWithType) {
      scrollToBottomWithType('user_message')
    }

    try {


      // Ensure message is not displayed in iframe
      // (removed unused setShowMessageInIframe call)

      // Send message to AI using fixed file info and PlanId
      await sendMessageToAI(
        content,
        selectedItems,
        actualFileDetails || undefined,
        planIdToUse || undefined
      )



      // Clear file state only after successful sending
      if (actualFileDetails) {
        setUploadedFileDetails(null)
        setCurrentPlanId(null)
        // Notify ChatInputArea to clear its internal file state
        // This will trigger ChatInputArea's clearFileState through onFileRemoved callback
        setShouldClearFile(true) // Set clear flag
      }
    } catch (error) {
      // Don't clear file state on send failure, let user retry
    } finally {
      setIsSending(false)
    }
  }

  // iframe communication related - ensure messages display in main interface
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle messages from iframe
      if (event.data && event.data.type === 'NEW_MESSAGE') {
        // Prevent display in iframe (removed unused state call)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Handle Auto Fix
  const handleAutoFix = useCallback(
    async (
      errors: Array<{
        message: string
        filename?: string
        lineno?: number
        colno?: number
        stack?: string
        blankScreen?: boolean
      }>
    ) => {
      if (isAutoFixing || isSending) return

      setIsAutoFixing(true)


      try {
        // Create a detailed error report for the AI
        const errorReport = errors
          .map((error, index) => {
            let report = `Error ${index + 1}: ${error.message}`
            if (error.filename) {
              report += `\n  File: ${error.filename}`
              if (error.lineno) {
                report += `:${error.lineno}`
                if (error.colno) {
                  report += `:${error.colno}`
                }
              }
            }
            if (error.stack) {
              report += `\n  Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n  ')}`
            }
            return report
          })
          .join('\n\n')

        const autoFixMessage = `Please analyze and fix the following ${errors.length} error${errors.length > 1 ? 's' : ''} detected in the application:\n\n${errorReport}\n\nPlease provide specific fixes for these errors, including any necessary code changes.`

        // Clear any existing message and send the auto-fix request
        setMessage('')
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }

        // Send the auto-fix message to AI
        await sendMessageToAI(autoFixMessage, selectedItems)

        // Clear internal detected errors after successful auto-fix request
        setInternalDetectedErrors([])

      } catch (error) {
        // Error during Auto Fix
      } finally {
        setIsAutoFixing(false)
      }
    },
    [isAutoFixing, isSending, sendMessageToAI, selectedItems, setMessage]
  )

  // Handle error detection from iframe (removed unused handleErrorDetected)

  // Handle history revert
  const handleRevertHistory: MessageListProps['revertHistory'] = async (planId) => {
    if (!revertHistory) return

    return await revertHistory(planId)
  }

  return (
    <section
      ref={chatContainerRef}
      className='flex h-full w-full flex-col overflow-hidden relative transition-colors
        /* Mobile: full screen overlay with safe areas */
        md:bg-transparent bg-background
        md:relative fixed md:inset-auto inset-0 z-50
        md:p-0 p-0'
      aria-label={m['chatPanel.main.ariaLabel']()}
    >
      {/* New message notification */}
      <NewMessageIndicator
        hasNewMessages={hasNewMessages}
        unreadCount={unreadCount}
        onScrollToBottom={handleScrollToBottomClick}
      />

      {/* Main chat area */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className='flex-1 overflow-y-auto ide-chat-main-area'
        aria-live='polite'
        role='log'
      >
        {/* Message list */}
        <div className='max-w-4xl mx-auto w-full'>
          <MessageList
            groupedMessages={groupedMessages}
            isLoading={isLoading}
            loading={loading}
            onFileClick={onFileClick}
            selectedItems={selectedItems}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            revertHistory={handleRevertHistory}
            removeSelectedItem={removeSelectedItem}
            onContentHeightChange={handleContentHeightChange}
            allMessages={messages} // Pass original messages array for TimingMessage access
          />
        </div>
      </div>

      {/* Element Editor Panel */}
      {editingState.isEditing && (
        <div className='px-4 pb-2'>
          <ElementEditorPanel
            editingState={editingState}
            onPropertyChange={updateElementProperty}
            onApplyChanges={applyElementChanges}
            onCancelChanges={cancelElementChanges}
            onDeleteElement={deleteElement}
            onClose={closeElementEditor}
            onSubmitToAI={async (message: string, selectedItems: unknown[]) => {
              // Force gpt-4-1 model for direct modifications and send message
              await sendMessageToAI(message, selectedItems, undefined, undefined, true)
            }}
          />
        </div>
      )}

      {/* Input area */}
      <div className='ide-chat-input-container'>
        <div className='max-w-4xl mx-auto w-full'>
          <ChatInputArea
          message={message}
          isSending={isSending}
          handleTextareaChange={handleTextareaChange}
          handleSendMessage={handleSendMessage}
          textareaRef={textareaRef}
          isInspectorActive={isInspectorActive}
          handleToggleInspector={handleToggleInspector}
          loadingStatus={loading}
          selectedItems={selectedItems}
          onRemoveSelectedItem={removeSelectedItem}
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
          onFileUploadSuccess={(fileDetails, planId) => {
            setUploadedFileDetails(fileDetails)
            setCurrentPlanId(planId)

          }}
          onFileRemoved={() => {

            setShouldClearFile(false) // Reset clear flag
          }}
          shouldClearFile={shouldClearFile}
          onStopGeneration={stopGeneration}
          isStopping={isStopping}
          canStop={canStop}
          usageData={usageData}
          isUsageLoading={isUsageLoading}
          detectedErrors={detectedErrors}
          onAutoFix={handleAutoFix}
        />
        </div>
      </div>
    </section>
  )
}
