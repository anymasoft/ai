/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-message-handler.ts
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

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { BrowserMessage, ErrorInfo } from '../utils/browser-utils'
import { MAX_MESSAGES, MESSAGE_TYPES } from '../utils/browser-utils'
import * as m from '@/paraglide/messages'



/**
 * Hook for handling iframe messages from the browser preview
 *
 * Handles communication between the iframe and the parent window:
 * 1. iframe URL changes → planId extracted
 * 2. inspect.js loads → notifies parent of script loading
 * 3. Handles element selection and error detection
 * 4. Manages inspector state synchronization
 */
export const useMessageHandler = (
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  onElementSelect?: (elementInfo: any) => void,
  inspectorActive?: boolean,
  onErrorDetected?: (errorInfo: ErrorInfo) => void
) => {
  const [selectedElement, setSelectedElement] = useState<any>(null)
  const [allMessages, setAllMessages] = useState<BrowserMessage[]>([])
  const [detectedErrors, setDetectedErrors] = useState<ErrorInfo[]>([])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
        // Debug all messages from iframe (enable for debugging)
        if (process.env.NODE_ENV === 'development') {
          console.log('[Browser Preview] 📨 Received message from iframe:', {
            type: event.data.type,
            payload: event.data.payload,
            timestamp: new Date().toISOString()
          })
        }

        // Add message to list
        setAllMessages((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            type: event.data.type,
            data: event.data,
          },
          ...prev.slice(0, MAX_MESSAGES - 1),
        ])

        // Handle element click
        if (event.data.type === MESSAGE_TYPES.ELEMENT_CLICKED) {
          setSelectedElement(event.data.payload)

          // Update selected element
          if (iframeRef.current?.contentWindow) {
            const updateMessage = {
              type: MESSAGE_TYPES.UPDATE_SELECTED_ELEMENTS,
              payload: [event.data.payload],
            }
            iframeRef.current.contentWindow.postMessage(updateMessage, '*')
          }

          onElementSelect?.(event.data.payload)
          toast.success(m["browserPreview.messageHandler.elementSelected"]())
        }
        
        // Handle script loading
        else if (event.data.type === MESSAGE_TYPES.SELECTOR_SCRIPT_LOADED) {
          const payload = event.data.payload
          console.log('[Browser Preview] ✅ Inspector script loaded successfully:', payload)

          // Sync inspector state
          if (inspectorActive && iframeRef.current?.contentWindow) {
            const syncMessage = { type: MESSAGE_TYPES.TOGGLE_SELECTOR, payload: true }
            iframeRef.current.contentWindow.postMessage(syncMessage, '*')
          }
        }

        // Handle runtime errors
        else if (event.data.type === MESSAGE_TYPES.RUNTIME_ERROR) {
          const errorInfo = event.data.error as ErrorInfo

          // Filter out generic "Script error." from cross-origin issues
          if (errorInfo.message === 'Script error.' &&
              errorInfo.filename === '' &&
              errorInfo.lineno === 0 &&
              errorInfo.colno === 0) {
            console.warn('[Browser Preview] Cross-origin script error detected (likely due to CORS restrictions):', {
              message: errorInfo.message,
              blankScreen: errorInfo.blankScreen,
              timestamp: new Date().toISOString()
            })

            // Only report if it's causing a blank screen
            if (errorInfo.blankScreen) {
              setDetectedErrors(prev => [{
                ...errorInfo,
                message: 'Cross-origin error detected - page may not be loading properly'
              }, ...prev.slice(0, 9)])
              onErrorDetected?.({
                ...errorInfo,
                message: 'Cross-origin error detected - page may not be loading properly'
              })
            }
            return
          }

          setDetectedErrors(prev => [errorInfo, ...prev.slice(0, 9)]) // Keep the latest 10 errors
          onErrorDetected?.(errorInfo)
          console.error('[Browser Preview] Runtime error detected:', errorInfo)
        }

        // Handle unhandled Promise rejections
        else if (event.data.type === MESSAGE_TYPES.UNHANDLED_PROMISE_REJECTION) {
          const errorInfo = event.data.error as ErrorInfo
          setDetectedErrors(prev => [errorInfo, ...prev.slice(0, 9)]) // Keep the latest 10 errors
          onErrorDetected?.(errorInfo)
          console.error('[Browser Preview] Unhandled promise rejection detected:', errorInfo)
        }





        // Handle content update notification
        else if (event.data.type === 'CONTENT_UPDATED') {
          const payload = event.data.payload
          console.log('[Browser Preview] Content update detected:', payload)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [iframeRef, onElementSelect, inspectorActive, onErrorDetected])

  return {
    selectedElement,
    allMessages,
    detectedErrors,
  }
} 