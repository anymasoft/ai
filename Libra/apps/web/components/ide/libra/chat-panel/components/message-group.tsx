/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * message-group.tsx
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
import { AlertCircle, Check, Code, Terminal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAvailableTabs, useMessageClassification, useMessageContent, useTabState } from './hooks'
import type { BaseMessage, TabType } from './types'
import { CommandSkeleton, DiffSkeleton, PlanSkeleton, TabLoadingIndicator } from './ui'
import { ContentPanel } from './ui/content-panel'
import { TabNavigation } from './ui/tab-navigation'

interface MessageGroupProps {
  messages: BaseMessage[]
  onFileClick?: (path: string) => void
  isLoading?: boolean
  isLastMessageGroup?: boolean
  planId?: string | undefined
  onRevert?: (planId: string) => void
  onContentHeightChange?: () => void
}

/**
 * Message group component - refactored version
 *
 * Simplified message group component that integrates MessageContainer functionality
 * Responsible for displaying a group of related messages, providing tab navigation and content display
 */
export const MessageGroup = ({
  messages,
  onFileClick,
  isLoading = false,
  isLastMessageGroup = true,
  planId,
  onRevert,
}: MessageGroupProps) => {
  // Content height state
  const [contentHeight, setContentHeight] = useState(300)
  const contentContainerRef = useRef<HTMLDivElement>(null)

  // Get icon mapping
  const tabIcons = {
    thinking: <AlertCircle className='h-4 w-4' aria-hidden='true' />,
    plan: <Check className='h-4 w-4' aria-hidden='true' />,
    commands: <Terminal className='h-4 w-4' aria-hidden='true' />,
    files: <Code className='h-4 w-4' aria-hidden='true' />,
    none: null,
  }

  // Classify messages
  const { thinking, plan, diff, commands } = useMessageClassification(messages)

  // Detect message completion status
  const isThinkingComplete = useMemo(() => {
    return thinking && (thinking as BaseMessage & { status?: string }).status === 'complete'
  }, [thinking])

  // Get thinking content - call hook at component top level
  const thinkingContent = useMessageContent(thinking)
  
  // Detect if there's an empty thinking message but loading
  const hasThinkingInProgress = useMemo(() => {
    // If thinking is complete, no longer show as in progress
    if (isThinkingComplete) return false
    return isLoading && thinking && (!thinkingContent || thinkingContent.trim() === '')
  }, [isLoading, thinking, isThinkingComplete, thinkingContent])

  // Get available tabs - pass loading state information
  const availableTabs = useAvailableTabs(
    thinking,
    plan,
    commands,
    diff,
    tabIcons,
    hasThinkingInProgress
  )

  // Handle tab state
  const { activeTab, isContentExpanded, handleTabClick } = useTabState(availableTabs)


  const planContent = useMessageContent(plan)

  // Listen for content height changes - support Plan and Thinking
  // Removed automatic scroll triggering on tab changes to fix unwanted scrolling
  useEffect(() => {
    if (isContentExpanded) {
      const timer = setTimeout(() => {
        let newHeight = 300 // Default height

        // Use more natural heights that allow content to breathe
        // Let components handle their own scrolling naturally
        if (activeTab === 'plan' && plan) {
          newHeight = 400 // Comfortable height for plan content
        }
        else if (activeTab === 'thinking' && thinking && thinkingContent.trim()) {
          // Remove all height limits for thinking content - show everything
          newHeight = 999999 // Effectively unlimited height
        }
        else if (activeTab === 'commands') {
          newHeight = 350 // Good height for commands
        }
        else if (activeTab === 'files') {
          // Remove height limits for files content - show everything like thinking
          newHeight = 999999 // Effectively unlimited height
        }

        setContentHeight(newHeight)

        // Note: Removed onContentHeightChange call to prevent unwanted scrolling on tab switches
        // Height changes alone should not trigger scrolling unless it's a new content arrival
      }, 50)

      return () => clearTimeout(timer)
    }
    // Return undefined when isContentExpanded is false
    return undefined
  }, [activeTab, plan, thinking, thinkingContent, isContentExpanded])

  // Loading state skeleton screen
  const renderSkeletons = () => {
    if (!isLoading) return null

    // Check if there's completed content
    const hasThinkingContentLocal = thinking && thinkingContent.trim()
    const hasPlanContentLocal = plan && planContent.trim()
    const hasCommandsContent = commands && commands.length > 0
    const hasFilesContent = (diff?.diff?.length ?? 0) > 0

    // If current tab has content, don't show skeleton screen
    if (activeTab === 'thinking' && hasThinkingContentLocal) return null
    if (activeTab === 'plan' && hasPlanContentLocal) return null
    if (activeTab === 'commands' && hasCommandsContent) return null
    if (activeTab === 'files' && hasFilesContent) return null

    // Simple version: only need tab loading indicator and skeleton screen
    return (
      <div className='w-full space-y-3'>
        {/* Tab loading state */}
        <TabLoadingIndicator className='mb-2' />

        {/* Show appropriate skeleton screen based on active tab or default state */}
        {activeTab === 'thinking' && !hasThinkingContentLocal && (
          <div className='rounded-md border border-border/40 overflow-hidden p-0.5 bg-card/40'>
            <PlanSkeleton />
          </div>
        )}

        {activeTab === 'plan' && !hasPlanContentLocal && (
          <div className='rounded-md border border-border/40 overflow-hidden bg-card/40'>
            <PlanSkeleton />
          </div>
        )}

        {activeTab === 'commands' && !hasCommandsContent && (
          <div className='rounded-md border border-border/40 overflow-hidden bg-card/40'>
            <CommandSkeleton />
          </div>
        )}

        {activeTab === 'files' && !hasFilesContent && (
          <div className='rounded-md border border-border/40 overflow-hidden bg-card/40'>
            <DiffSkeleton />
          </div>
        )}

        {/* Default display thinking skeleton screen when no tab is selected */}
        {!activeTab && (
          <div className='rounded-md border border-border/40 overflow-hidden bg-card/40'>
            <PlanSkeleton />
          </div>
        )}
      </div>
    )
  }

  // Fix handleTabClick type issue
  const handleTabNavClick = (tabId: string, _action?: 'toggle' | 'expand' | 'collapse') => {
    handleTabClick(tabId as TabType)
  }

  // Render component
  return (
    <div className='w-full text-fg transition-all duration-300 ease-in-out'>
      {/* Tab navigation - add rollback functionality */}
      {availableTabs.length > 0 && (
        <div className='transition-all duration-300 ease-in-out'>
          <TabNavigation
            tabs={availableTabs}
            activeTab={activeTab as string}
            isContentExpanded={isContentExpanded}
            onTabClick={handleTabNavClick}
            isLastMessage={isLastMessageGroup}
            planId={planId || ''}
            onRevert={onRevert || (() => {})}
            isLoading={isLoading}
            baseHeight={contentHeight}
            adaptiveHeight={false} // Disable TabNavigation's adaptive height, controlled uniformly by this component
            projectName='Current Project' // TODO: Get actual project name from context
          />
        </div>
      )}

      {/* Content area - use fixed height baseline */}
      <div
        ref={contentContainerRef}
        className={cn(
          'transition-all duration-300 ease-in-out content-height-container',
          (activeTab === 'thinking' || activeTab === 'files') ? 'overflow-visible' : 'overflow-hidden',
          isContentExpanded ? 'opacity-100' : 'max-h-0 opacity-0'
        )}
        style={{
          maxHeight: isContentExpanded
            ? ((activeTab === 'thinking' || activeTab === 'files') ? 'none' : `${contentHeight}px`)
            : '0px',
        }}
      >
        {/* Prioritize displaying existing content, only show skeleton screen when there's no content */}
        {(() => {
          // Check if current tab has content
          const hasContent = (() => {
            switch (activeTab) {
              case 'thinking':
                return thinking && thinkingContent.trim()
              case 'plan':
                return plan && planContent.trim()
              case 'commands':
                return commands && commands.length > 0
              case 'files':
                return diff && (diff.diff?.length ?? 0) > 0
              default:
                return false
            }
          })()

          // If there's content, directly display content panel
          if (hasContent || !isLoading) {
            return (
              <ContentPanel
                activeTab={activeTab}
                isContentExpanded={isContentExpanded}
                {...(thinking && { thinking: thinking as BaseMessage })}
                {...(plan && { plan: plan as BaseMessage })}
                commands={commands}
                {...(diff && { diff })}
                onFileClick={onFileClick || (() => {})}
                isLoading={isLoading}
                hasThinkingInProgress={hasThinkingInProgress || false}
                {...(planId && { planId })}
              />
            )
          }

          // Otherwise show skeleton screen
          return renderSkeletons()
        })()}
      </div>
    </div>
  )
}
