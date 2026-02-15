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

import { cn } from '@libra/ui/lib/utils'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState, useMemo } from 'react'

import { usePreviewStore } from '@/components/ide/libra/hooks/use-preview-store'
import { useProjectContext } from '@/lib/hooks/use-project-id'
import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
// Import components
import { BrowserToolbar } from './components/browser-toolbar'
import { ChatPanel } from './components/chat-panel'
import { FrameViewer } from './components/frame-viewer'
import { MessageDialog } from './components/message-dialog'
import { ScreenshotModal } from './components/screenshot-modal'
// Import custom hooks
import { useIframeManager } from './hooks/use-iframe-manager'
import { useMessageHandler } from './hooks/use-message-handler'
import { useURLHandler } from './hooks/use-url-handler'
// Import tools and types
import type { MessageItem } from './utils/browser-utils'
import { extractPlanIdFromURL } from './utils/browser-utils'

interface BrowserPreviewProps {
  onElementSelect?: (elementInfo: any) => void
  inspectorActive: boolean
  onInspectorChange?: (isActive: boolean) => void
  showChat?: boolean
  onErrorDetected?: (errorInfo: {
    message: string
    filename?: string
    lineno?: number
    colno?: number
    stack?: string
    blankScreen?: boolean
  }) => void
}

// Browser preview component
const BrowserPreview = forwardRef<
  {
    toggleInspector: (isActive?: boolean) => void
    sendInspectorStateToIframe: (isActive: boolean) => void
  },
  BrowserPreviewProps
>(
  (
    {
      showChat = true,
      onElementSelect,
      inspectorActive,
      onInspectorChange,
      onErrorDetected,
    }: BrowserPreviewProps,
    ref
  ) => {
    // Get preview state from Zustand
    const { previewURL, isPreviewVisible, isLoadingURL, setPreviewURL, setIsLoadingURL } =
      usePreviewStore()

    // Get project ID
    const { projectId } = useProjectContext()
    const trpc = useTRPC()

    // Local state
    const [isMobileView, setIsMobileView] = useState(false)
    const [showMessages, setShowMessages] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showScreenshotModal, setShowScreenshotModal] = useState(false)

    // Get the latest planId from project history
    const { data: projectHistory } = useQuery({
      ...trpc.history.getAll.queryOptions({ id: projectId || '' }),
      enabled: Boolean(projectId),
    })

    // Extract the latest planId from message history
    const latestPlanIdFromHistory = useMemo(() => {
      if (!projectHistory || !Array.isArray(projectHistory) || projectHistory.length === 0) {
        return null
      }

      // Find the most recent message with a planId (reverse iteration for better performance)
      for (let i = projectHistory.length - 1; i >= 0; i--) {
        const message = projectHistory[i]
        if (message?.planId) {
          return message.planId
        }
      }

      return null
    }, [projectHistory])


    // Query to get the preview URL with planId
    const {
      data: previewUrlData,
      isLoading: isLoadingPreviewUrl,
      error: previewUrlError,
      refetch: fetchPreviewURL,
    } = useQuery({
      ...trpc.project.getPreviewUrl.queryOptions({
        id: projectId || '',
      }),
      enabled: Boolean(projectId && isPreviewVisible),
    })

    // Handle preview URL data change
    useEffect(() => {
      if (previewUrlData?.success && previewUrlData.previewURL) {
        const newURL = previewUrlData.previewURL

        // Only update if URL actually changed to prevent unnecessary re-renders
        if (newURL !== previewURL) {
          setPreviewURL(newURL)
        }

        setIsLoadingURL(false)
      } else if (previewUrlData && !previewUrlData.success) {
        toast.error(m['browserPreview.index.getPreviewUrlFailed']())
        setIsLoadingURL(false)
      }
    }, [previewUrlData, previewURL, setPreviewURL, setIsLoadingURL])

    // Handle preview URL error
    useEffect(() => {
      if (previewUrlError) {
        toast.error(m['browserPreview.index.getPreviewUrlError']())
        setIsLoadingURL(false)
      }
    }, [previewUrlError, setIsLoadingURL])

    // Set loading state when switching to Preview, but don't clear URL
    useEffect(() => {
      if (isPreviewVisible && projectId) {
        // Only set loading state if there is no preview URL
        if (!previewURL) {
          setIsLoadingURL(true)
        }
      }
    }, [isPreviewVisible, projectId, previewURL, setIsLoadingURL])

    // Function to manually refresh the preview URL
    const handleRefreshPreview = useCallback(async () => {
      // Debounce check
      if (isRefreshing) {
        return
      }

      if (!projectId) {
        toast.error(m['browserPreview.index.projectIdMissing']())
        return
      }

      setIsRefreshing(true)
      setIsLoadingURL(true)

      try {
        await fetchPreviewURL()
      } catch {
        setIsLoadingURL(false)
      } finally {
        setIsRefreshing(false)
      }
    }, [projectId, fetchPreviewURL, setIsLoadingURL, isRefreshing])

    // State to track if we've performed the initial check (only once per component mount)
    const [hasPerformedInitialCheck, setHasPerformedInitialCheck] = useState(false)

    // Determine if this is a page refresh scenario (no URL planId but history planId exists)
    const isPageRefreshScenario = useMemo(() => {
      if (!previewURL || !latestPlanIdFromHistory) return false
      const existingPlanId = extractPlanIdFromURL(previewURL)
      return !existingPlanId && !!latestPlanIdFromHistory
    }, [previewURL, latestPlanIdFromHistory])

    // Enhance preview URL with planId only for page refresh scenarios
    const enhancedPreviewURL = useMemo(() => {
      if (!previewURL) {
        return null
      }

      // If URL already has a planId, use it as-is (normal chat flow)
      const existingPlanId = extractPlanIdFromURL(previewURL)
      if (existingPlanId) {
        return previewURL
      }

      // Enhance URL for page refresh scenarios
      // Only add planId if we truly need it (page refresh scenario)
      if (isPageRefreshScenario && latestPlanIdFromHistory && !hasPerformedInitialCheck) {
        try {
          const url = new URL(previewURL)
          url.searchParams.set('planId', latestPlanIdFromHistory)
          return url.toString()
        } catch {
          return previewURL
        }
      }

      return previewURL
    }, [previewURL, latestPlanIdFromHistory, isPageRefreshScenario, hasPerformedInitialCheck])

    // Use custom hooks
    const { actualURL } = useURLHandler(enhancedPreviewURL)

    // Extract planId from the actual URL for screenshot storage
    const planId = extractPlanIdFromURL(actualURL)

    // Determine the effective planId to use for screenshot operations
    // Priority: URL-based planId (from active editing) > latest planId from history (from page refresh)
    const effectivePlanId = planId || latestPlanIdFromHistory





    // One-time check on component initialization for page refresh scenarios
    useEffect(() => {
      // Only run once per component mount
      if (hasPerformedInitialCheck) {
        return
      }

      // Wait for all required data to be available
      if (!projectHistory || !previewURL) {
        return
      }

      setHasPerformedInitialCheck(true)
    }, [hasPerformedInitialCheck, projectHistory, previewURL])

    const { iframeRef, isLoading, toggleInspector, sendInspectorStateToIframe, handleIframeLoad } =
      useIframeManager(actualURL, inspectorActive, onInspectorChange)

    const { selectedElement, allMessages } = useMessageHandler(
      iframeRef,
      onElementSelect,
      inspectorActive,
      onErrorDetected,
    )

    // Expose methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        toggleInspector,
        sendInspectorStateToIframe,
      }),
      [toggleInspector, sendInspectorStateToIframe,]
    )

    // Determine if loading state should be shown
    const showLoading = isLoadingURL || isLoadingPreviewUrl || isLoading



    return (
      <div
        className={cn(
          'flex flex-col w-full h-full overflow-hidden rounded-lg relative',
          'border border-border-default/50 shadow-sm',
          'dark:border-border-emphasis/30 dark:shadow-lg',
          'bg-background/50 backdrop-blur-sm'
        )}
      >
        {/* Toolbar */}
        <BrowserToolbar
          url={actualURL}
          onURLChange={setPreviewURL}
          onRefresh={handleRefreshPreview}
          isLoading={isRefreshing}
          isMobileView={isMobileView}
          onViewChange={setIsMobileView}
          inspectorActive={inspectorActive}
          onInspectorToggle={toggleInspector}
          onMessagesToggle={() => setShowMessages((prev) => !prev)}
        />

        {/* iframe container */}
        <div className={cn('flex-grow flex justify-center overflow-hidden')}>
          <div
            className={cn(
              'h-full transition-all duration-300 ease-in-out flex items-start shadow-md',
              'bg-white overflow-hidden',
              'dark:shadow-2xl',
              isMobileView
                ? 'w-[375px] max-w-full mt-4 rounded-t-lg border-x border-t border-border-default'
                : 'w-full'
            )}
          >
            {/* iframe */}
            <FrameViewer
              ref={iframeRef}
              src={actualURL}
              isLoading={showLoading}
              onLoad={handleIframeLoad}
              className='w-full h-full bg-white dark:border-border-emphasis'
            />
          </div>
        </div>

        {/* Message panel */}
        {showMessages && (
          <MessageDialog
            messages={allMessages}
            onClose={() => setShowMessages(false)}
            className='absolute bottom-4 right-4 w-96 max-w-[calc(100%-2rem)] max-h-[70vh] shadow-lg rounded-lg border border-border-default dark:-subtle dark:border-border-emphasis'
          />
        )}

        {/* Chat panel */}
        {showChat && (
          <div
            className={cn(
              'absolute bottom-0 right-0 w-96 max-w-full h-auto',
              'dark:-subtle dark:border-border-emphasis'
            )}
          >
            <ChatPanel selectedElement={selectedElement} onMessageSend={() => {}} />
          </div>
        )}
      </div>
    )
  }
)

BrowserPreview.displayName = 'BrowserPreview'

export default BrowserPreview
export type { MessageItem }
