/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-iframe-manager.ts
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as m from '@/paraglide/messages'
import { MESSAGE_TYPES } from '../utils/browser-utils'

export const useIframeManager = (
  actualURL: string | null,
  inspectorActive: boolean,
  onInspectorChange?: (isActive: boolean) => void
) => {
  const [isLoading, setIsLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const sendInspectorStateToIframe = useCallback((isActive: boolean) => {
    if (!iframeRef.current?.contentWindow) return

    const message = { type: MESSAGE_TYPES.TOGGLE_SELECTOR, payload: isActive }

    try {
      iframeRef.current.contentWindow.postMessage(message, '*')

      if (!isActive) {
        const clearMessage = { type: MESSAGE_TYPES.UPDATE_SELECTED_ELEMENTS, payload: [] }
        iframeRef.current.contentWindow.postMessage(clearMessage, '*')
      }
    } catch (error) {
      toast.error(m['browserPreview.iframeManager.cannotCommunicate']())
    }
  }, [])

  const refreshIframe = useCallback(() => {
    if (actualURL) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [actualURL])

  const toggleInspector = useCallback(
    (newStateParam?: boolean) => {
      const newState = newStateParam !== undefined ? newStateParam : !inspectorActive

      onInspectorChange?.(newState)
      sendInspectorStateToIframe(newState)

      const message = newState
        ? m['browserPreview.iframeManager.inspectorActivated']()
        : m['browserPreview.iframeManager.inspectorDeactivated']()
      toast.success(message, { id: 'inspector-toggle', duration: 3000 })
    },
    [inspectorActive, onInspectorChange, sendInspectorStateToIframe]
  )

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)

    if (iframeRef.current && actualURL) {
      const currentSrc = iframeRef.current.src

      // Check for unexpected redirects
      try {
        const expectedUrl = new URL(actualURL)
        const actualUrl = new URL(currentSrc)

        // Compare base URLs without query parameters for redirect detection
        if (expectedUrl.origin + expectedUrl.pathname !== actualUrl.origin + actualUrl.pathname) {
          if (currentSrc.includes('localhost')) {
            toast.warning(m['browserPreview.iframeManager.urlRedirected']())
          }
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
  }, [actualURL])

  // Handle iframe load error
  const handleIframeError = useCallback(() => {
    setIsLoading(false)
    toast.error(m['browserPreview.iframeManager.pageLoadFailed']())
  }, [])

  // Sync inspector state to iframe
  useEffect(() => {
    sendInspectorStateToIframe(inspectorActive)
  }, [inspectorActive, sendInspectorStateToIframe])

  // URL change handling - removed automatic refresh on URL change
  // The FrameViewer component now handles URL changes more intelligently
  useEffect(() => {
    if (!actualURL) {
      setIsLoading(false)
    }
  }, [actualURL])

  // Add iframe load and error event listeners
  // @ts-ignore
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad)
      iframe.addEventListener('error', handleIframeError)
      return () => {
        iframe.removeEventListener('load', handleIframeLoad)
        iframe.removeEventListener('error', handleIframeError)
      }
    }
  }, [handleIframeLoad, handleIframeError])

  return {
    iframeRef,
    isLoading,
    refreshIframe,
    toggleInspector,
    sendInspectorStateToIframe,
    handleIframeLoad,
  }
}
