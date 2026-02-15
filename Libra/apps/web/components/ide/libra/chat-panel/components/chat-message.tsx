/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-message.tsx
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
import { cn } from '@libra/ui/lib/utils'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, Code, FileText, CheckCircle2, AlertCircle, Terminal, User } from 'lucide-react'
import { MessageSkeleton } from './ui'
import type { MessageComponentProps } from './ui/message-types'
import type { BaseMessage, DetailedLoadingStatus, LoadingStage } from './types'
import { isUserMessage, isThinkingMessage, isPlanMessage, isDiffMessage, isCommandMessage } from './types'

/**
 * Get message content text
 * Handle content that may be string or object
 */
const getMessageContent = (message: BaseMessage): string => {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (message.content && typeof message.content === 'object') {
    return message.content.text || message.content.thinking || '';
  }

  if (typeof message.message === 'string') {
    return message.message;
  }

  return '';
};

/**
 * Core chat message component
 *
 * Responsible for rendering individual messages, including user messages and various types of AI response messages
 * Supports collapsible thinking process, error display and retry functionality
 */
export const ChatMessage: React.FC<MessageComponentProps> = ({ 
  message, 
  onRetry, 
  onFileClick, 
  loadingStatus, 
  isEnhancedMode = true,
  className
}) => {

  // State management
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isCodeChangesExpanded, setIsCodeChangesExpanded] = useState(false);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const messageId = message.id || message.planId || 'unknown';

  // Get message content text
  const messageText = getMessageContent(message);

  // Calculate current loading stage
  const getCurrentStage = useCallback((): LoadingStage => {
    if (!loadingStatus) return 'complete';

    if (loadingStatus.startsWith('thinking')) return 'thinking';
    if (loadingStatus.startsWith('description')) return 'description';
    if (loadingStatus.startsWith('actions')) return 'actions';
    return 'complete';
  }, [loadingStatus]);

  // Check if currently loading
  const isLoading = useCallback((): boolean => {
    if (!loadingStatus) return false;
    return loadingStatus !== 'completed' && loadingStatus !== 'error';
  }, [loadingStatus]);

  // Auto-expand thinking process
  useEffect(() => {
    if (isThinkingMessage(message) && messageText.length > 0) {
      setIsThinkingExpanded(true);
    }
  }, [message, messageText]);

  // Keyboard operation handling
  const handleKeyDown = useCallback((event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }, []);

  // Toggle thinking process display
  const handleThinkingToggle = useCallback(() => {
    const newState = !isThinkingExpanded;
    setIsThinkingExpanded(newState);

    // Screen reader notification
    const announcement = newState ? m["chatPanel.message.thinkingExpanded"]() : m["chatPanel.message.thinkingCollapsed"]();
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  }, [isThinkingExpanded]);

  // Toggle code changes display
  const handleCodeChangesToggle = useCallback(() => {
    const newState = !isCodeChangesExpanded;
    setIsCodeChangesExpanded(newState);
  }, [isCodeChangesExpanded]);

  // File click handling
  const handleFileClick = useCallback((path: string) => {
    if (onFileClick) {
      onFileClick(path);
    }
  }, [onFileClick]);

  // Render error information
  const renderError = () => {
    if (!message.error) return null;

    const errorMessage = typeof message.error === 'string' ? message.error : 'Unknown error';

    return (
      <div
        className="flex flex-col gap-3 p-4 rounded-lg
                 bg-destructive/5 border border-destructive/20 text-destructive
                 animate-in fade-in duration-300"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-2 text-destructive font-medium">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{m["chatPanel.message.processingError"]()}</span>
        </div>
        <p className="text-sm text-destructive/80">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={() => {
              onRetry();
            }}
            className="flex items-center gap-2 text-sm mt-2 px-3 py-1.5 rounded-md
                     bg-destructive/10 text-destructive hover:bg-destructive/20
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50
                     transition-colors"
            aria-label={m["chatPanel.message.retry"]()}
          >
            <Terminal className="h-4 w-4" aria-hidden="true" />
            {m["chatPanel.message.retry"]()}
          </button>
        )}
      </div>
    );
  };

  // Get message styles
  const getMessageStyles = () => {
    if (isUserMessage(message)) {
      return "bg-accent/5 border border-accent/20 rounded-lg p-3 ml-auto max-w-[85%]";
    }
    
    if (isThinkingMessage(message)) {
      return "bg-card/50 border border-border/50 rounded-lg p-3 max-w-[90%]";
    }
    
    if (isPlanMessage(message)) {
      return "bg-primary/5 border border-primary/20 rounded-lg p-3 max-w-[90%]";
    }
    
    if (isDiffMessage(message)) {
      return "bg-muted/50 border border-border/40 rounded-lg p-3 max-w-[90%]";
    }
    
    if (isCommandMessage(message)) {
      return "bg-secondary/30 border border-secondary/40 rounded-lg p-3 max-w-[90%]";
    }
    
    return "p-3 max-w-[90%]";
  };

  // Render skeleton screen
  const renderSkeleton = () => {
    if (!isThinkingMessage(message) || messageText || !isEnhancedMode) {
      return null;
    }

    const currentStage = getCurrentStage();
    const active = isLoading();

    if (active && !messageText) {
      const variant = currentStage === 'thinking' ? 'compact' : 
                     currentStage === 'description' ? 'default' : 'expanded';
      
      const lines = currentStage === 'thinking' ? 3 : 
                   currentStage === 'description' ? 4 : 5;
      
      return (
          // @ts-ignore
        <MessageSkeleton 
          isActive={true} 
          lines={lines} 
          className={currentStage === 'actions' ? 'border border-border/30 rounded-md p-3 bg-muted/10' : undefined}
        />
      );
    }

    return null;
  };

  // Render message content
  const renderMessageContent = () => {
    // Special handling for thinking messages
    if (isThinkingMessage(message)) {
      // If no content and in processing state, return null (skeleton will be rendered elsewhere)
      if (!messageText && isLoading()) {
        return null;
      }

      // Has content, show toggle button and content
      if (messageText?.trim()) {
        // Only show thinking content toggle after loading is complete
        const active = isLoading();
        if (active) return null;

        return (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleThinkingToggle}
              onKeyDown={(e) => handleKeyDown(e, handleThinkingToggle)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground
                       transition-colors focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-ring rounded px-1 py-0.5"
              aria-expanded={isThinkingExpanded}
              aria-controls={`thinking-content-${messageId}`}
              aria-label={isThinkingExpanded ? m["chatPanel.message.collapseThinking"]() : m["chatPanel.message.expandThinking"]()}
            >
              {isThinkingExpanded ?
                <ChevronDown className="h-3 w-3" aria-hidden="true" /> :
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              }
              <span>{m["chatPanel.message.viewThinkingProcess"]()}</span>
            </button>

            {isThinkingExpanded && (
              <section
                id={`thinking-content-${messageId}`}
                className="text-sm text-muted-foreground leading-relaxed p-3
                         bg-muted/30 border border-border/40 rounded
                         animate-in slide-in-from-top-1 duration-200"
                aria-label={m["chatPanel.message.thinkingProcessDetails"]()}
              >
                {messageText}
              </section>
            )}
          </div>
        );
      }

      return null;
    }

    // Regular message content handling
    if (messageText) {
      return (
        <section
          className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
          aria-label={m["chatPanel.message.messageContent"]()}
        >
          {messageText}
        </section>
      );
    }

    return null;
  };

  // Main render
  return (
    <div 
      className={cn(
        getMessageStyles(),
        "flex flex-col gap-2",
        className
      )}
      ref={contentRef}
    >
      {renderSkeleton()}
      {renderMessageContent()}
      {renderError()}
    </div>
  );
}; 