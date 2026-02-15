/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * BrowserPreviewContext.tsx
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

import { createContext, useContext, type RefObject } from 'react'
import type { MessageItem } from '../index'

// Extend MessageItem to include timestamp and read status
export interface EnhancedMessageItem extends MessageItem {
  timestamp?: Date;
  isRead?: boolean;
}

// Add history item type
export interface HistoryItem {
  url: string;
  timestamp: Date;
  title?: string;
}

// Extend context type
interface BrowserPreviewContextType {
  // Basic properties
  url: string;
  setUrl: (url:string) => void;
  displayUrl?: string;
  isMobileView: boolean;
  setIsMobileView: (isMobile: boolean) => void;
  isLoading: boolean;
  refreshIframe: () => void;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  
  // Inspector related
  inspectorActive: boolean;
  toggleInspector: (isActive?: boolean) => void;
  
  // Message related
  messages: EnhancedMessageItem[];
  setMessages: (messages: EnhancedMessageItem[] | ((prev: EnhancedMessageItem[]) => EnhancedMessageItem[])) => void;
  selectedElement: any | null;
  setSelectedElement: (element: any | null) => void;
  
  // Enhanced features
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  history: HistoryItem[];
  addToHistory: (item: HistoryItem) => void;
  clearHistory: () => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  logAction: (action: string, data?: any) => void;
}

// Create context, initial value is undefined, actual value will be provided in the Provider
export const BrowserPreviewContext = createContext<BrowserPreviewContextType | undefined>(undefined);

// Create a hook to use the context in components
export function useBrowserPreview(): BrowserPreviewContextType {
  const context = useContext(BrowserPreviewContext);
  
  if (!context) {
    throw new Error('useBrowserPreview must be used within a BrowserPreviewContext.Provider');
  }
  
  return context;
} 