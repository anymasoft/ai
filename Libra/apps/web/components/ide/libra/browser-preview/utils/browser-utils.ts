/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * browser-utils.ts
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

// Browser preview utility functions
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

export const normalizeURL = (url: string): string => {
  if (!isValidURL(url)) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // For localhost URLs, default to http:// instead of https://
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return `http://${url}`
      }
      return `https://${url}`
    }
  }
  return url
}

/**
 * Extract planId from preview URL
 * Looks for planId in URL path segments or query parameters
 */
export const extractPlanIdFromURL = (url: string | null): string | null => {
  if (!url || !isValidURL(url)) {
    return null
  }

  try {
    const urlObj = new URL(url)

    // Check query parameters first
    const planIdFromQuery = urlObj.searchParams.get('planId')
    if (planIdFromQuery) {
      return planIdFromQuery
    }

    // Check path segments for planId patterns
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)

    // Look for segments that look like planIds (e.g., "update-1750136131527")
    for (const segment of pathSegments) {
      if (segment.includes('-') && /\d{10,}/.test(segment)) {
        return segment
      }
    }

    // Look for segments that start with common planId prefixes
    for (const segment of pathSegments) {
      if (segment.startsWith('update-') || segment.startsWith('plan-') || segment.startsWith('preview-')) {
        return segment
      }
    }

    return null
  } catch (error) {
    return null
  }
}

// Message type definitions
export interface MessageItem {
  text: string
  isAssistant: boolean
  elementData?: any
  customFormat?: boolean
}

export interface BrowserMessage {
  timestamp: string
  type: string
  data: any
}

// Error monitoring data types
export interface ErrorInfo {
  message: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string
  blankScreen?: boolean
}

export interface RuntimeErrorMessage {
  type: 'RUNTIME_ERROR'
  error: ErrorInfo
}

export interface UnhandledPromiseRejectionMessage {
  type: 'UNHANDLED_PROMISE_REJECTION'
  error: ErrorInfo
}

export interface ScreenshotCaptureMessage {
  type: 'CAPTURE_SCREENSHOT'
  payload?: {
    format?: 'png' | 'jpeg'
    quality?: number
  }
}

export interface ScreenshotCapturedMessage {
  type: 'SCREENSHOT_CAPTURED'
  payload: {
    dataUrl: string
    format: string
    timestamp: number
  }
}

export interface ScreenshotErrorMessage {
  type: 'SCREENSHOT_ERROR'
  payload: {
    error: string
    timestamp: number
  }
}

export interface ScreenshotStoredMessage {
  type: 'SCREENSHOT_STORED'
  payload: {
    key: string
    planId: string
    timestamp: number
  }
}

export interface ScreenshotRetrieveMessage {
  type: 'SCREENSHOT_RETRIEVE'
  payload: {
    planId: string
  }
}

export interface HistoryUpdateMessage {
  type: 'HISTORY_UPDATE'
  payload: {
    planId: string
    screenshotKey: string
    previewUrl: string
    timestamp: number
  }
}

// Constants
export const MAX_MESSAGES = 50

// Message types
export const MESSAGE_TYPES = {
  TOGGLE_SELECTOR: 'TOGGLE_SELECTOR',
  UPDATE_SELECTED_ELEMENTS: 'UPDATE_SELECTED_ELEMENTS',
  ELEMENT_CLICKED: 'ELEMENT_CLICKED',
  SELECTOR_SCRIPT_LOADED: 'SELECTOR_SCRIPT_LOADED',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  UNHANDLED_PROMISE_REJECTION: 'UNHANDLED_PROMISE_REJECTION',
  CONSOLE_OUTPUT: 'CONSOLE_OUTPUT',
  CAPTURE_SCREENSHOT: 'CAPTURE_SCREENSHOT',
  SCREENSHOT_CAPTURED: 'SCREENSHOT_CAPTURED',
  SCREENSHOT_ERROR: 'SCREENSHOT_ERROR',
  SCREENSHOT_STORED: 'SCREENSHOT_STORED',
  SCREENSHOT_RETRIEVE: 'SCREENSHOT_RETRIEVE',
  HISTORY_UPDATE: 'HISTORY_UPDATE',
} as const