/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * browser-toolbar.tsx
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

import { useCallback, useState, useEffect, useRef } from 'react'
import type { KeyboardEvent, FormEvent } from 'react'
import { Button } from '@libra/ui/components/button'
import { Input } from '@libra/ui/components/input'
import { cn } from '@libra/ui/lib/utils'
import {
  ArrowLeft, ArrowRight, ExternalLink, Loader2, RefreshCw,
  Smartphone, Code, Eye, History, Moon, Sun, MoonStar, X, Camera
} from 'lucide-react'
import { toast } from 'sonner'
import * as m from '@/paraglide/messages'

// History item definition
interface HistoryItem {
  url: string;
  timestamp: Date;
  title: string;
}

// Tooltip component
interface TooltipProps {
  id: string;
  children: React.ReactNode;
  text: string;
}

interface BrowserToolbarProps {
  url: string | null;
  onURLChange: (url: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  isMobileView: boolean;
  onViewChange: (isMobile: boolean) => void;
  inspectorActive: boolean;
  onInspectorToggle: (isActive?: boolean) => void;
  onMessagesToggle?: () => void;
  onScreenshotCapture?: () => void;
}

// URL validation and formatting function
const formatURL = (url: string): string => {
  let formattedUrl = url.trim();
  
  // Do not process empty URL
  if (!formattedUrl) return '';
  
  // Try adding protocol if it doesn't exist
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }
  
  // Return formatted URL
  return formattedUrl;
};

export const BrowserToolbar = ({
  url,
  onURLChange,
  onRefresh,
  isLoading = false,
  isMobileView,
  onViewChange,
  inspectorActive,
  onInspectorToggle,
  onMessagesToggle,
  onScreenshotCapture
}: BrowserToolbarProps) => {
  // Local state
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [hoveredButtonId, setHoveredButtonId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [urlInputValue, setUrlInputValue] = useState(url || '');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  
  const historyRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  
  // Update input value when URL changes
  useEffect(() => {
    setUrlInputValue(url || '');
  }, [url]);
  
  // Add to history function
  const addToHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => {
      // Check if URL already exists in history
      const exists = prev.some(hi => hi.url === item.url);
      if (exists) {
        // Update timestamp of existing entry
        return prev.map(hi => 
          hi.url === item.url 
            ? { ...hi, timestamp: item.timestamp } 
            : hi
        );
      }
      // Add new entry
      return [item, ...prev.slice(0, 19)]; // Keep up to 20 history items
    });
  }, []);
  
  // Simple log function
  const logAction = useCallback((category: string, action: string) => {
    console.log(`[Browser Toolbar] ${category}: ${action}`);
  }, []);
  
  // Log current URL to history
  useEffect(() => {
    if (url && !isLoading) {
      addToHistory({
        url,
        timestamp: new Date(),
        title: url
      });
    }
  }, [url, isLoading, addToHistory]);
  
  // Handle URL submission
  const handleUrlSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    
    if (urlInputValue) {
      const formattedUrl = formatURL(urlInputValue);
      console.log('[Browser Toolbar] Submitting URL:', {
        originalInput: urlInputValue,
        formatted: formattedUrl
      });
      
      // If URL changes, update state
      if (formattedUrl !== url) {
        onURLChange(formattedUrl);
        // No need to call refreshIframe as URL change will trigger iframe refresh
        logAction('URL Change', `Set new URL: ${formattedUrl}`);
      } else {
        // URL unchanged, but user clicked refresh
        onRefresh();
        logAction('Browser Navigation', 'Refresh current page');
      }
    }
    
    // Exit editing mode
    setIsEditingUrl(false);
  };
  
  // Listen for keydown events on URL input
  const handleUrlInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUrlSubmit();
    } else if (e.key === 'Escape') {
      // Cancel edit, restore original URL
      setUrlInputValue(url || '');
      setIsEditingUrl(false);
    }
  };
  
  // Handle back and forward navigation
  const goBack = useCallback(() => {
    const iframe = document.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.back();
      logAction('Browser Navigation', 'Go back to previous page');
    }
  }, [logAction]);

  const goForward = useCallback(() => {
    const iframe = document.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.forward();
      logAction('Browser Navigation', 'Go to next page');
    }
  }, [logAction]);
  
  // Track which tooltip is currently displayed
  const handleButtonMouseEnter = useCallback((id: string) => {
    setHoveredButtonId(id);
  }, []);
  
  const handleButtonMouseLeave = useCallback(() => {
    setHoveredButtonId(null);
  }, []);
  
  // Handle touch devices
  const handleTouchStart = useCallback(() => {
    setIsTouching(true);
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
  }, []);
  
  // Toggle theme
  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
    logAction('UI', `Switched theme to ${nextTheme}`);
    toast.success(m["browserPreview.toolbar.themeChanged"]({ theme: nextTheme }));
  }, [theme, logAction]);
  
  // Toggle device view
  const toggleDeviceView = useCallback(() => {
    onViewChange(!isMobileView);
    logAction('UI', `Switched to ${!isMobileView ? 'mobile' : 'desktop'} view`);
    toast.success(m["browserPreview.toolbar.viewChanged"]({ view: !isMobileView ? 'mobile' : 'desktop' }));
  }, [isMobileView, onViewChange, logAction]);
  
  // Handle history item click
  const handleHistoryItemClick = (historyItem: HistoryItem) => {
    onURLChange(historyItem.url);
    setUrlInputValue(historyItem.url);
    onRefresh();
    setShowHistory(false);
    logAction('Browser Navigation', `Loading from history: ${historyItem.url}`);
  };
  
  // Toggle history
  const toggleHistory = () => {
    setShowHistory(!showHistory);
    logAction('Browser Navigation', `${!showHistory ? 'Show' : 'Hide'} history`);
  };
  
  // Focus URL input
  const focusUrlInput = () => {
    setIsEditingUrl(true);
    // Use setTimeout to ensure focus after state update
    setTimeout(() => {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    }, 0);
  };
  
  // Close history on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    
    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHistory]);
  
  // Add touch event listeners
  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
  
  // Tooltip component
  const Tooltip = useCallback(({ id, children, text }: TooltipProps) => {
    const isVisible = hoveredButtonId === id && !isTouching;
    
    return (
      <div className="relative">
        <div
          onMouseEnter={() => handleButtonMouseEnter(id)}
          onMouseLeave={handleButtonMouseLeave}
        >
          {children}
        </div>
        {isVisible && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs font-medium bg-fg-default text-on-fg rounded whitespace-nowrap z-50">
            {text}
          </div>
        )}
      </div>
    );
  }, [hoveredButtonId, isTouching, handleButtonMouseEnter, handleButtonMouseLeave]);
  
  // Get theme icon function
  const getThemeIcon = () => {
    if (theme === 'light') {
      return <MoonStar className="h-5 w-5 transition-opacity" />;
    }
    if (theme === 'dark') {
      return <Sun className="h-5 w-5 transition-opacity" />;
    }
    return <Moon className="h-5 w-5 transition-opacity" />;
  };
  
  // Get theme tooltip text
  const getThemeTooltip = () => {
    if (theme === 'light') {
      return m["browserPreview.toolbar.switchToDarkTheme"]();
    }
    if (theme === 'dark') {
      return m["browserPreview.toolbar.switchToLightTheme"]();
    }
    return m["browserPreview.toolbar.switchToSystemTheme"]();
  };
  
  return (
    <div 
      className={cn(
        "flex flex-col relative border-b border-border-emphasis transition-colors", 
        "dark:border-border-emphasis dark:-subtle" // Dark mode border and background colors
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center px-3 h-10 w-full">
        {/* Navigation buttons */}
        <div className="flex items-center mr-2">
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            className={cn(
              "p-1 rounded-md transition-colors",
              "text-fg-muted hover:text-fg-default hover:-emphasis",
              "dark:text-fg-muted dark:hover:text-fg-default dark:hover:-emphasis", // Dark mode styles
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={m["browserPreview.toolbar.back"]()}
            onMouseEnter={() => handleButtonMouseEnter('back')}
            onMouseLeave={handleButtonMouseLeave}
          >
            <ArrowLeft className="h-4 w-4" />
            {hoveredButtonId === 'back' && !isTouching && (
              <div className="absolute top-full left-3 mt-1 px-2 py-1 text-xs rounded -emphasis text-fg-default dark:-emphasis dark:text-fg-default">
                {m["browserPreview.toolbar.back"]()}
              </div>
            )}
          </button>
          
          <button
            type="button"
            onClick={goForward}
            disabled={!canGoForward}
            className={cn(
              "p-1 rounded-md transition-colors ml-1",
              "text-fg-muted hover:text-fg-default hover:-emphasis",
              "dark:text-fg-muted dark:hover:text-fg-default dark:hover:-emphasis", // Dark mode styles
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={m["browserPreview.toolbar.forward"]()}
            onMouseEnter={() => handleButtonMouseEnter('forward')}
            onMouseLeave={handleButtonMouseLeave}
          >
            <ArrowRight className="h-4 w-4" />
            {hoveredButtonId === 'forward' && !isTouching && (
              <div className="absolute top-full left-10 mt-1 px-2 py-1 text-xs rounded -emphasis text-fg-default dark:-emphasis dark:text-fg-default">
                {m["browserPreview.toolbar.forward"]()}
              </div>
            )}
          </button>
          
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              "p-1 rounded-md transition-colors ml-1",
              "text-fg-muted hover:text-fg-default hover:-emphasis",
              "dark:text-fg-muted dark:hover:text-fg-default dark:hover:-emphasis", // Dark mode styles
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={m["browserPreview.toolbar.refresh"]()}
            onMouseEnter={() => handleButtonMouseEnter('refresh')}
            onMouseLeave={handleButtonMouseLeave}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {hoveredButtonId === 'refresh' && !isTouching && (
              <div className="absolute top-full left-16 mt-1 px-2 py-1 text-xs rounded -emphasis text-fg-default dark:-emphasis dark:text-fg-default">
                {m["browserPreview.toolbar.refresh"]()}
              </div>
            )}
          </button>
        </div>
        
        {/* Address bar */}
        <div 
          className={cn(
            "flex-1 mx-1 h-7 rounded-md overflow-hidden group ",
            "border border-border-default",
            "dark:-subtle dark:border-border-emphasis", // Dark mode styles
            "transition-all"
          )}
        >
          <div 
            className={cn(
              "flex items-center px-3 h-full text-sm truncate",
              "text-fg-default",
              "dark:text-fg-default" // Dark mode styles
            )}
          >
            {"/"}
          </div>
        </div>
        
        {/* Function buttons */}
        <div className="flex items-center ml-2">
          <button
            type="button"
            onClick={toggleDeviceView}
            className={cn(
              "p-1 rounded-md transition-colors",
              isMobileView
                ? "text-fg-accent -accent-subtle"
                : "text-fg-muted hover:text-fg-default hover:-emphasis",
              "dark:text-fg-muted dark:hover:text-fg-default dark:hover:-emphasis", // Dark mode styles
              isMobileView && "dark:text-fg-accent dark:-accent-subtle", // Dark mode active state
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={isMobileView ? m["browserPreview.toolbar.switchToDesktop"]() : m["browserPreview.toolbar.switchToMobile"]()}
            onMouseEnter={() => handleButtonMouseEnter('device')}
            onMouseLeave={handleButtonMouseLeave}
          >
            <Smartphone className="h-4 w-4" />
            {hoveredButtonId === 'device' && !isTouching && (
              <div className="absolute top-full right-4 mt-1 px-2 py-1 text-xs rounded -emphasis text-fg-default dark:-emphasis dark:text-fg-default">
                {isMobileView ? m["browserPreview.toolbar.switchToDesktop"]() : m["browserPreview.toolbar.switchToMobile"]()}
              </div>
            )}
          </button>

          {onScreenshotCapture && (
            <button
              type="button"
              onClick={onScreenshotCapture}
              className={cn(
                "p-1 rounded-md transition-colors ml-1",
                "text-fg-muted hover:text-fg-default hover:-emphasis",
                "dark:text-fg-muted dark:hover:text-fg-default dark:hover:-emphasis", // Dark mode styles
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={m['ide.browserToolbar.takeScreenshotAriaLabel']()}
              onMouseEnter={() => handleButtonMouseEnter('screenshot')}
              onMouseLeave={handleButtonMouseLeave}
            >
              <Camera className="h-4 w-4" />
              {hoveredButtonId === 'screenshot' && !isTouching && (
                <div className="absolute top-full right-4 mt-1 px-2 py-1 text-xs rounded -emphasis text-fg-default dark:-emphasis dark:text-fg-default">
                  {m['ide.browserToolbar.takeScreenshot']()}
                </div>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* History popover has been removed */}
    </div>
  );
}; 