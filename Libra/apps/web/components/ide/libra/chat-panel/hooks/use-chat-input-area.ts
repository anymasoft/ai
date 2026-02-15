/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-chat-input-area.ts
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

import { useCallback, useState } from 'react';
import { useFileUpload } from './use-file-upload';
import { useTextareaResize } from './use-textarea-resize';
import { generateChatInputStyles } from '../utils/chat-input-styles';

interface UseChatInputAreaProps {
  message: string;
  isSending: boolean;
  handleSendMessage: (e: React.FormEvent, fileDetails?: { key: string; name: string; type: string } | null, planId?: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleToggleInspector: () => void;
  isInspectorActive: boolean;
  onFileUploadSuccess: (fileDetails: { key: string; name: string; type: string }, planId: string) => void;
  onFileRemoved?: () => void;
}

export const useChatInputArea = ({
  message,
  isSending,
  handleSendMessage,
  textareaRef,
  handleToggleInspector,
  isInspectorActive,
  onFileUploadSuccess,
  onFileRemoved,
}: UseChatInputAreaProps) => {
  // Message validation constants
  const messageLength = message.length;
  const maxMessageLength = 500;
  const isOverLimit = messageLength > maxMessageLength;

  // UI state management - consolidated into single state object
  const [uiState, setUiState] = useState({
    isFormHovered: false,
    isFormFocused: false,
    showHelpPanel: false,
    hoverStates: { mic: false, edit: false, image: false, send: false }
  });

  // Extract file upload functionality
  const fileUpload = useFileUpload({
    onFileUploadSuccess,
    ...(onFileRemoved && { onFileRemoved }),
    logPrefix: '[ChatInputArea]'
  });

  // Extract textarea resize functionality
  const { autoResizeTextarea } = useTextareaResize({
    textareaRef,
    logPrefix: '[ChatInputArea]'
  });

  // Generate styles using extracted utility
  const styles = generateChatInputStyles({
    hoverStates: uiState.hoverStates,
    isOverLimit,
    isSending,
    message,
    isInspectorActive,
    messageLength,
    maxMessageLength,
  });

  // Function to update button hover states
  const updateHoverState = useCallback((key: keyof typeof uiState.hoverStates, isHovered: boolean) => {
    setUiState(prev => ({
      ...prev,
      hoverStates: { ...prev.hoverStates, [key]: isHovered }
    }));
  }, []);
  
  // Consolidated form event handlers
  const handleFormMouseEnter = useCallback(() => {
    setUiState(prev => ({ ...prev, isFormHovered: true }));
  }, []);

  const handleFormMouseLeave = useCallback(() => {
    setUiState(prev => ({ ...prev, isFormHovered: false }));
  }, []);

  const handleFormFocus = useCallback(() => {
    setUiState(prev => ({ ...prev, isFormFocused: true }));
  }, []);

  const handleFormBlur = useCallback(() => {
    setUiState(prev => ({ ...prev, isFormFocused: false }));
  }, []);

  const handleHelpToggle = useCallback(() => {
    setUiState(prev => ({ ...prev, showHelpPanel: !prev.showHelpPanel }));
  }, [uiState.showHelpPanel]);
  
  // Consolidated message sending logic
  const handleMessageSend = useCallback((e: React.MouseEvent<HTMLButtonElement> | React.FormEvent) => {
    e.preventDefault();

    // Validate message can be sent (allow files without text)
    if ((isOverLimit || (!message.trim() && !fileUpload.uploadedFileKey)) || isSending) {
      return;
    }

    // Prepare file details if available
    const fileDetails = fileUpload.uploadedFileKey
      ? {
          key: fileUpload.uploadedFileKey,
          name: fileUpload.uploadedFileName || '',
          type: fileUpload.uploadedFileType || ''
        }
      : null;

    // Send message and let parent handle file state cleanup
    handleSendMessage(e as React.FormEvent, fileDetails, fileUpload.currentPlanId || undefined);
  }, [message, isOverLimit, isSending, handleSendMessage, fileUpload]);
  
  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Allow Enter key to send messages with files or text
      if (!isOverLimit && (message.trim() !== '' || fileUpload.uploadedFileKey) && !isSending) {
        handleSendMessage(e);
      }
    }
  }, [handleSendMessage, isOverLimit, isSending, message, fileUpload.uploadedFileKey]);

  // Handle element selector button click
  const handleInspectorToggle = useCallback(() => {
    handleToggleInspector();
  }, [handleToggleInspector]);

  // Return hook's public API with extracted functionality
  return {
    messageLength,
    maxMessageLength,
    isOverLimit,
    // UI state from consolidated state object
    isFormHovered: uiState.isFormHovered,
    isFormFocused: uiState.isFormFocused,
    showHelpPanel: uiState.showHelpPanel,
    // Button style classes from extracted utility
    counterClasses: styles.counterClasses,
    toolButtonClasses: styles.toolButtonClasses,
    sendButtonClasses: styles.sendButtonClasses,
    selectorButtonClasses: styles.selectorButtonClasses,
    // Event handler functions
    handleFormMouseEnter,
    handleFormMouseLeave,
    handleFormFocus,
    handleFormBlur,
    handleHelpToggle,
    handleMessageSend,
    handleKeyDown,
    handleInspectorToggle,
    // Special functionality from extracted hooks
    autoResizeTextarea,
    // Utility functions
    updateHoverState,
    // File upload related from extracted hook
    fileInputRef: fileUpload.fileInputRef,
    handleFileSelectClick: fileUpload.handleFileSelectClick,
    handleFileChange: fileUpload.handleFileChange,
    handleRemoveUploadedFile: fileUpload.handleRemoveUploadedFile,
    uploadedFileKey: fileUpload.uploadedFileKey,
    uploadedFileName: fileUpload.uploadedFileName,
    uploadedFileType: fileUpload.uploadedFileType,
    previewImageUrl: fileUpload.previewImageUrl,
    isUploadingFile: fileUpload.isUploadingFile,
    uploadError: fileUpload.uploadError,
    clearFileState: fileUpload.clearFileState,
    currentPlanId: fileUpload.currentPlanId,
    isDeletingFile: fileUpload.isDeletingFile,
  };
};