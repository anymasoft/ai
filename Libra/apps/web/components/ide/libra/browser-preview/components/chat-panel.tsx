/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-panel.tsx
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

import { useCallback, useRef, useState, useEffect } from 'react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import { X, Check, Send, Clock, Copy, ChevronRight, FileCode, AlertCircle, Command } from 'lucide-react'
import { toast } from 'sonner'
import type { MessageItem } from '../index'
import * as m from '@/paraglide/messages'

// Add timestamp to messages
type EnhancedMessageItem = MessageItem & {
  timestamp?: Date;
  isRead?: boolean;
};

// Message group type
type MessageGroup = EnhancedMessageItem[];

interface ChatPanelProps {
  selectedElement?: any;
  onMessageSend?: (text: string) => void;
}

export const ChatPanel = ({ selectedElement, onMessageSend }: ChatPanelProps) => {
  const [messages, setMessages] = useState<EnhancedMessageItem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // Add typing status
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Function to scroll to the bottom
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);
  
  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);
  
  // Typing indicator effect
  useEffect(() => {
    if (newMessage.length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (newMessage.length === 0 && isTyping) {
      setIsTyping(false);
    }
  }, [newMessage, isTyping]);

  // Add message on element selection change
  useEffect(() => {
    if (selectedElement) {
      // Add system message with timestamp
      const elementMessage: EnhancedMessageItem = { 
        text: m["browserPreview.chat.elementSelected"]({ tagName: selectedElement.tagName || "unknown element" }),
        isAssistant: true,
        elementData: selectedElement,
        timestamp: new Date(),
        isRead: true
      };
      
      setMessages(prev => [...prev, elementMessage]);
      
      // Scroll to bottom
      setTimeout(scrollToBottom, 50);
    }
  }, [selectedElement, scrollToBottom]);
  
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    
    if (newMessage.trim()) {
      setIsSending(true);
      setIsTyping(false);
      
      // Add user message with timestamp
      const userMessage: EnhancedMessageItem = { 
        text: newMessage, 
        isAssistant: false,
        timestamp: new Date(),
        isRead: true
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Call parent component's callback
      if (onMessageSend) {
        onMessageSend(newMessage);
      }
      
      setNewMessage("");
      
      // Scroll to bottom
      setTimeout(scrollToBottom, 50);
      
      // Simulate assistant reply
      setTimeout(() => {
        const assistantMessage: EnhancedMessageItem = {
          text: m["browserPreview.chat.assistantReply"](),
          isAssistant: true,
          timestamp: new Date(),
          isRead: true
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsSending(false);
        // Focus input after sending
        inputRef.current?.focus();
        
        // Scroll to bottom
        setTimeout(scrollToBottom, 50);
      }, 1000);
    }
  }, [newMessage, scrollToBottom, onMessageSend]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Close chat on Esc key
    if (e.key === 'Escape') {
      // Add logic to close chat here
    }
  }, []);
  
  // Group consecutive messages from the same sender
  const groupedMessages: MessageGroup[] = [];
  
  // Safely group messages
  messages.forEach((message, index) => {
    // Check if a new group needs to be created
    if (
      index === 0 || // First message
      !messages[index-1] || // Prevent accessing non-existent message
      messages[index-1]?.isAssistant !== message?.isAssistant // Use optional chaining to access properties
    ) {
      // Create a new group
      groupedMessages.push([message]);
    } else {
      // Add to existing group
      const lastGroupIndex = groupedMessages.length - 1;
      if (lastGroupIndex >= 0) {
        groupedMessages[lastGroupIndex]?.push(message);
      }
    }
  });
  
  return (
    <div 
      className="w-full md:w-[420px] flex flex-col h-full border-l border-border-default  dark:-subtle dark:border-border-emphasis min-h-0 shadow-lg"
      onKeyDown={handleKeyDown}
    >
      <div className="border-b border-border-default dark:border-border-emphasis p-4 flex items-center justify-between -subtle dark:-emphasis">
        <Button 
          size="sm" 
          variant="ghost" 
          type="button"
          className="h-8 w-8 p-0 text-fg-muted hover:text-fg-default dark:text-fg-muted dark:hover:text-fg-default 
                    hover:-emphasis dark:hover:-emphasis rounded-full
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={m["browserPreview.chat.showMoreOptions"]()}
        >
          <FileCode className="w-4 h-4" />
        </Button>
        <div className="flex items-center">
          <div className="w-2 h-2 bg-success-fg dark:bg-success-fg rounded-full mr-2 animate-pulse" />
          <h2 className="text-lg font-medium text-fg-default dark:text-fg-default">{m["browserPreview.chat.title"]()}</h2>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          type="button"
          className="h-8 w-8 p-0 text-fg-muted hover:text-fg-default dark:text-fg-muted dark:hover:text-fg-default 
                    hover:-emphasis dark:hover:-emphasis rounded-full
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={m["browserPreview.chat.closeChat"]()}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div 
        ref={chatContainerRef}
        className="flex-1 p-4 md:p-6 overflow-y-auto  dark:-subtle min-h-0 scroll-smooth"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 bg-accent-bg-subtle dark:bg-accent-bg-subtle rounded-full flex items-center justify-center mb-6 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-accent dark:text-fg-accent">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-fg-default dark:text-fg-default mb-3">{m["browserPreview.chat.startConversation"]()}</h3>
            <p className="text-fg-muted dark:text-fg-muted max-w-sm mb-6">{m["browserPreview.chat.startConversationHelper"]()}</p>
            
            <div className="w-full max-w-sm border border-border-default dark:border-border-emphasis rounded-xl overflow-hidden shadow-sm">
              <div className="-subtle dark:-emphasis px-4 py-3 border-b border-border-default dark:border-border-emphasis">
                <h3 className="text-sm font-medium text-fg-default dark:text-fg-default">{m["browserPreview.chat.quickQuestions"]()}</h3>
              </div>
              <div className="divide-y divide-border-default dark:divide-border-emphasis">
                <button 
                  type="button"
                  className="w-full flex items-center p-4 text-left text-fg-default dark:text-fg-default 
                           hover:-subtle dark:hover:-emphasis transition-colors"
                  onClick={() => {
                    setNewMessage(m["browserPreview.chat.question1"]());
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  <ChevronRight className="w-4 h-4 mr-3 text-fg-accent dark:text-fg-accent" />
                  <span>{m["browserPreview.chat.question1"]()}</span>
                </button>
                <button 
                  type="button"
                  className="w-full flex items-center p-4 text-left text-fg-default dark:text-fg-default
                           hover:-subtle dark:hover:-emphasis transition-colors"
                  onClick={() => {
                    setNewMessage(m["browserPreview.chat.question2"]());
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  <ChevronRight className="w-4 h-4 mr-3 text-fg-accent dark:text-fg-accent" />
                  <span>{m["browserPreview.chat.question2"]()}</span>
                </button>
                <button 
                  type="button"
                  className="w-full flex items-center p-4 text-left text-fg-default dark:text-fg-default
                           hover:-subtle dark:hover:-emphasis transition-colors"
                  onClick={() => {
                    setNewMessage(m["browserPreview.chat.question3"]());
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  <ChevronRight className="w-4 h-4 mr-3 text-fg-accent dark:text-fg-accent" />
                  <span>{m["browserPreview.chat.question3"]()}</span>
                </button>
              </div>
            </div>
            
            <div className="mt-6 text-xs text-fg-subtle dark:text-fg-subtle flex items-center">
              <Command className="w-3 h-3 mr-1" /> {m["browserPreview.chat.keyboardShortcut"]()} <kbd className="mx-1 px-1.5 py-0.5 -subtle dark:-emphasis rounded text-fg-muted dark:text-fg-muted">Ctrl+K</kbd> {m["browserPreview.chat.keyboardShortcutSuffix"]()}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMessages.map((group, groupIndex) => {
              const isAssistant = group[0]?.isAssistant;
              const isFirstGroup = groupIndex === 0;
              
              return (
                <div 
                  key={groupIndex} 
                  className={cn(
                    "flex",
                    isAssistant ? "justify-start" : "justify-end",
                    !isFirstGroup && "mt-6"
                  )}
                >
                  <div className={cn(
                    "max-w-[85%] space-y-2",
                    isAssistant && "mr-12",
                    !isAssistant && "ml-12"
                  )}>
                    {group.map((message, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "rounded-lg p-4",
                          isAssistant 
                            ? "-subtle dark:-emphasis text-fg-default dark:text-fg-default rounded-tl-sm" 
                            : "bg-accent-bg-subtle dark:bg-accent-bg-subtle text-fg-default dark:text-fg-default rounded-tr-sm"
                        )}
                      >
                        {(message.elementData && index === 0) ? (
                          <MessageContent 
                            message={message}
                            iframeRef={iframeRef}
                            isFirstInGroup={index === 0}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{message.text}</div>
                        )}
                        
                        {/* Message timestamp */}
                        {index === group.length - 1 && message.timestamp && (
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <span className="text-[10px] text-fg-subtle dark:text-fg-subtle">
                              {formatTime(message.timestamp)}
                            </span>
                            {!isAssistant && (
                              <Check className="w-3 h-3 text-fg-subtle dark:text-fg-subtle" />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Typing indicator */}
            {isSending && (
              <div className="flex justify-start">
                <div className="-subtle dark:-emphasis text-fg-default dark:text-fg-default rounded-lg p-4 max-w-[85%] rounded-tl-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1 items-center">
                      <div className="w-2 h-2 bg-fg-subtle dark:bg-fg-subtle rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-fg-subtle dark:bg-fg-subtle rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-fg-subtle dark:bg-fg-subtle rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-fg-muted dark:text-fg-muted">{m["browserPreview.chat.thinking"]()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t border-border-default dark:border-border-emphasis -subtle dark:-emphasis">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={m["browserPreview.chat.placeholder"]()}
              disabled={isSending}
              className="w-full px-4 py-2  dark:-subtle text-fg-default dark:text-fg-default placeholder:text-fg-subtle dark:placeholder:text-fg-subtle 
                         border border-border-default dark:border-border-emphasis rounded-full 
                         focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                         disabled:opacity-70"
            />
          </div>
          <Button
            type="submit"
            size="icon" 
            disabled={!newMessage.trim() || isSending}
            className="h-10 w-10 rounded-full bg-fg-accent text-white hover:bg-accent-hover disabled:opacity-50
                     flex items-center justify-center flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

// Format time function
const formatTime = (date: Date): string => {
  if (!date || !(date instanceof Date)) return '';
  
  try {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    return '';
  }
};

// Message content component
interface MessageContentProps {
  message: EnhancedMessageItem;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  isFirstInGroup: boolean;
}

const MessageContent = ({ message, iframeRef, isFirstInGroup }: MessageContentProps) => {
  // Safely extract elementData from message
  const elementData = message.elementData || {};
  const filePath = elementData.filePath || '';
  const tagName = elementData.tagName || 'div';
  const className = elementData.className || '';
  const id = elementData.id || '';
  const componentPath = elementData['data-component-path'] || '';
  
  // Safely get filename
  const getFileName = () => {
    try {
      return filePath.split('/').pop() || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  // Safely get component name
  const getComponentName = () => {
    try {
      return componentPath.split('/').pop() || "";
    } catch {
      return "";
    }
  };
  
  return (
    <div className={cn(
      "rounded-lg p-3 md:p-4 text-base max-w-[95%] shadow-sm transition-all hover:shadow",
      message.isAssistant 
        ? "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-tr-none"
        : "bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/50 text-gray-900 dark:text-gray-100 rounded-tl-none"
    )}>
      {message.customFormat && message.elementData ? (
        // Custom format for selected element
        <div className="flex bg-green-50 dark:bg-green-900/40 border border-green-100 dark:border-green-900/50 rounded-md p-3 justify-between items-center">
          <div className="flex items-center">
            <span className="text-green-800 dark:text-green-300 mr-1 text-sm">1. </span>
            <span className="text-green-800 dark:text-green-300 mr-1 text-sm font-medium">
              {getFileName()}
            </span>
            <span className="text-green-800 dark:text-green-300 mx-1 text-sm">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="10px" width="10px" xmlns="http://www.w3.org/2000/svg">
                <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
              </svg>
            </span>
            <span className="text-green-800 dark:text-green-300 text-sm font-medium">
              {tagName.toLowerCase()}
            </span>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            type="button"
            className="h-7 w-7 p-0 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/50 hover:text-green-900 dark:hover:text-green-300
                     focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:outline-none rounded"
            aria-label={m["browserPreview.chat.copyElementPath"]()}
            onClick={() => {
              navigator.clipboard.writeText(filePath);
              toast.success(m["browserPreview.chat.copiedToClipboard"](), {
                duration: 2000,
                position: "top-center"
              });
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{message.text}</div>
      )}
      
      {/* Element info display area */}
      {message.elementData && !message.customFormat && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col text-sm space-y-2">
            <div className="flex">
              <span className="font-medium text-gray-900 dark:text-gray-100 mr-2 w-16">{m["browserPreview.chat.element"]()}:</span>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono text-blue-600 dark:text-blue-400">
                {`<${tagName}${id ? ` id="${id}"` : ''}>`}
              </code>
            </div>
            {className && (
              <div className="flex">
                <span className="font-medium text-gray-900 dark:text-gray-100 mr-2 w-16">{m["browserPreview.chat.className"]()}:</span>
                <span className="truncate max-w-[260px] font-mono text-gray-600 dark:text-gray-400">{className}</span>
              </div>
            )}
            {componentPath && (
              <div className="flex">
                <span className="font-medium text-gray-900 dark:text-gray-100 mr-2 w-16">{m["browserPreview.chat.component"]()}:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{getComponentName()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 