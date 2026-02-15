/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * tab-navigation.tsx
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

import { cn } from '@libra/ui/lib/utils'
import { ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TabInfo } from '../../hooks/use-message-hooks'
import { ForkConfirmationModal } from './fork-confirmation-modal'
import { TabActionButtons } from './tab-action-buttons'
import { useTabScrolling } from '../../hooks/use-tab-scrolling'
import { useForkFunctionality } from '../../hooks/use-fork-functionality'


interface TabNavigationProps {
  tabs: TabInfo[]
  activeTab: string
  isContentExpanded: boolean
  onTabClick: (tabId: string, action?: 'toggle' | 'expand' | 'collapse') => void
  isLastMessage?: boolean
  planId?: string
  onRevert?: (planId: string) => void
  isLoading?: boolean
  baseHeight?: number
  adaptiveHeight?: boolean
  planContentHeight?: number
  planContentLines?: number
  thinkingContentHeight?: number
  thinkingContentLines?: number
  projectName?: string
}

export const TabNavigation = ({
  tabs,
  activeTab,
  isContentExpanded,
  onTabClick,
  isLastMessage = false,
  planId,
  onRevert,
  isLoading = false,
  baseHeight = 200,
  adaptiveHeight = true,
  planContentHeight,
  planContentLines,
  thinkingContentHeight,
  thinkingContentLines,
  projectName,
}: TabNavigationProps) => {
  if (!tabs.length) return null

  const canRevert = Boolean(!isLastMessage && !isLoading && onRevert && planId)

  // Use custom hooks for extracted functionality
  const {
    tabsContainerRef,
    isScrollable,
    showLeftScroll,
    showRightScroll,
    handleTabsScroll,
    scrollTabs,
  } = useTabScrolling()

  const {
    showForkModal,
    isForkLoading,
    canFork,
    isQuotaExhausted,
    isQuotaLoading,
    handleForkClick,
    handleForkConfirm,
    handleForkCancel,
    getQuotaMessage,
    canCreateProject,
  } = useForkFunctionality(planId, isLoading)

  const [contentHeight, setContentHeight] = useState(baseHeight)
  const hasPlanTab = tabs.some((tab) => tab.id === 'plan')
  const hasThinkingTab = tabs.some((tab) => tab.id === 'thinking')

  useEffect(() => {
    if (!adaptiveHeight || !isContentExpanded) return

    // Plan content height calculation
    if (activeTab === 'plan' && hasPlanTab && planContentHeight && planContentLines) {
      const heightFactor = Math.min(Math.max(planContentHeight / 1000, 1), 1.5)
      const appropriateHeight = Math.min(
        Math.max(planContentLines * 20 * heightFactor + 40, baseHeight),
        500
      )

      setContentHeight(appropriateHeight)
    }

    // Thinking content height calculation
    // Remove height limit for thinking tab to allow full content display
    else if (activeTab === 'thinking' && hasThinkingTab && thinkingContentHeight && thinkingContentLines) {
      const heightFactor = Math.min(Math.max(thinkingContentHeight / 1000, 1), 1.5)
      const appropriateHeight = Math.max(thinkingContentLines * 20 * heightFactor + 40, baseHeight) // Remove 500px max height limit

      setContentHeight(appropriateHeight)
    }
  }, [isContentExpanded, activeTab, adaptiveHeight, hasPlanTab, hasThinkingTab, baseHeight, planContentHeight, planContentLines, thinkingContentHeight, thinkingContentLines])



  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault()
        const nextIndex = tabs.findIndex((t) => t.id === tabId) + 1
        if (nextIndex < tabs.length && tabs[nextIndex]?.id) {
          onTabClick(tabs[nextIndex].id)
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const prevIndex = tabs.findIndex((t) => t.id === tabId) - 1
        if (prevIndex >= 0 && tabs[prevIndex]?.id) {
          onTabClick(tabs[prevIndex].id)
        }
        break
      }
      case 'Enter':
      case ' ':
        e.preventDefault()
        onTabClick(tabId)
        break
    }
  }



  return (
    <div className='bg-card rounded-t-md relative ring-1 ring-border/30 backdrop-blur-[1px] will-change-transform'>
      <div className='flex items-center justify-between px-2 py-1 overflow-hidden'>
        {isScrollable && showLeftScroll && (
          <button
            type='button'
            onClick={() => scrollTabs('left')}
            className='absolute left-0 z-10 flex h-full items-center justify-center px-1.5 bg-gradient-to-r from-card via-card to-transparent'
            aria-label='Scroll tabs left'
          >
            <div className='flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-fg/70 hover:bg-accent/20 hover:text-fg transition-all duration-200 ring-1 ring-border/20 hover:ring-accent/30 transform hover:scale-105 active:scale-95'>
              <ChevronUp className='h-3.5 w-3.5 rotate-270' />
            </div>
          </button>
        )}

        <div
          ref={tabsContainerRef}
          className='flex items-center overflow-x-auto scrollbar-none py-1.5 pl-1.5 pr-5 scroll-smooth'
          onScroll={handleTabsScroll}
          role='tablist'
          aria-label='Tab navigation'
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => onTabClick(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={cn(
                'group relative px-3 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out',
                'rounded-md mx-0.5 flex items-center',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'transform hover:translate-y-[-1px] active:translate-y-[0px]',
                activeTab === tab.id
                  ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-accent-foreground/10'
                  : 'text-fg-subtle hover:text-fg hover:bg-accent/10 ring-1 ring-transparent hover:ring-border/30'
              )}
              aria-selected={activeTab === tab.id}
              role='tab'
              tabIndex={activeTab === tab.id ? 0 : -1}
              aria-label={`${tab.label} tab`}
              aria-controls={`panel-${tab.id}`}
              data-tab-id={tab.id}
            >
              <div className='flex items-center gap-1.5'>
                {tab.icon && (
                  <span
                    className={cn(
                      'text-current transition-transform duration-200',
                      activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'
                    )}
                  >
                    <span className='block h-3.5 w-3.5'>{tab.icon}</span>
                  </span>
                )}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className='ml-1 inline-flex items-center justify-center rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-accent/10 animate-in fade-in duration-300'>
                    {tab.badge}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {isScrollable && showRightScroll && (
          <button
            type='button'
            onClick={() => scrollTabs('right')}
            className='absolute right-10 z-10 flex h-full items-center justify-center px-1.5 bg-gradient-to-l from-card via-card to-transparent'
            aria-label='Scroll tabs right'
          >
            <div className='flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-fg/70 hover:bg-accent/20 hover:text-fg transition-all duration-200 ring-1 ring-border/20 hover:ring-accent/30 transform hover:scale-105 active:scale-95'>
              <ChevronUp className='h-3.5 w-3.5 rotate-90' />
            </div>
          </button>
        )}

        <TabActionButtons
          canFork={canFork}
          canCreateProject={canCreateProject}
          planId={planId}
          isLoading={isLoading}
          isForkLoading={isForkLoading}
          isQuotaExhausted={isQuotaExhausted}
          isQuotaLoading={isQuotaLoading}
          onForkClick={handleForkClick}
          getQuotaMessage={getQuotaMessage}
          canRevert={canRevert}
          onRevert={onRevert}
        />
      </div>

      {/* Fork confirmation modal */}
      <ForkConfirmationModal
        open={showForkModal}
        onClose={handleForkCancel}
        onConfirm={handleForkConfirm}
        isLoading={isForkLoading}
        projectName={projectName}
        planId={planId}
      />
    </div>
  )
}
