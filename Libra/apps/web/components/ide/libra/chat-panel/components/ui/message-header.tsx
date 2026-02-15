/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * message-header.tsx
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
import { Tabs, TabsList, TabsTrigger } from '@libra/ui/components/tabs'
import { Button } from '@libra/ui/components/button'
import { Badge } from '@libra/ui/components/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback } from 'react'
import type { TabType } from '../../hooks/use-message-state'
import { RollbackIcon } from '../../../../../common/Icon'

// Tab information interface
interface TabInfo {
  id: TabType
  label: string
  icon?: React.ReactNode
  count?: number
  badge?: string
}

interface MessageHeaderProps {
  tabs: TabInfo[]
  activeTab: TabType
  isExpanded: boolean
  onTabChange: (tabId: TabType) => void
  onToggleExpanded: () => void
  isLastMessage?: boolean
  planId?: string
  onRevert?: (planId: string) => void
  isLoading?: boolean
  className?: string
}

/**
 * Message header component
 * Uses shadcn/ui Tabs component to provide tab navigation
 * Includes expand/collapse control and rollback functionality
 */
const MessageHeader = ({
  tabs,
  activeTab,
  isExpanded,
  onTabChange,
  onToggleExpanded,
  isLastMessage = false,
  planId,
  onRevert,
  isLoading = false,
  className
}: MessageHeaderProps) => {
  // Handle tab switching
  const handleTabChange = useCallback((value: string) => {
    onTabChange(value as TabType)
  }, [onTabChange])

  // Handle rollback operation
  const handleRevert = useCallback(() => {
    if (onRevert && planId) {
      onRevert(planId)
    }
  }, [onRevert, planId])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        onToggleExpanded()
        break
      case 'Escape':
        if (isExpanded) {
          onToggleExpanded()
        }
        break
    }
  }, [onToggleExpanded, isExpanded])

  // Check if rollback is possible
  const canRevert = !isLastMessage && !isLoading && onRevert && planId

  if (tabs.length === 0) {
    return null
  }

  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-t-lg overflow-hidden",
        "transition-all duration-300 ease-in-out",
        className
      )}
    >
      <div className="flex items-center justify-between px-1">
        {/* Tab navigation area */}
        <div className="flex-1 min-w-0">
          <Tabs 
            value={activeTab} 
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList 
              className={cn(
                "h-auto p-1 bg-transparent",
                "grid w-full",
                tabs.length === 1 && "grid-cols-1",
                tabs.length === 2 && "grid-cols-2", 
                tabs.length === 3 && "grid-cols-3",
                tabs.length === 4 && "grid-cols-4",
                tabs.length > 4 && "flex overflow-x-auto"
              )}
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "relative px-3 py-2 text-xs sm:text-sm font-medium",
                    "transition-all duration-200 ease-in-out",
                    "data-[state=active]:bg-background data-[state=active]:text-foreground",
                    "data-[state=active]:shadow-sm data-[state=active]:border",
                    "hover:bg-accent/50 hover:text-accent-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    "disabled:pointer-events-none disabled:opacity-50"
                  )}
                  disabled={isLoading && tab.id !== activeTab}
                  aria-label={`${tab.label} tab`}
                  aria-controls={`panel-${tab.id}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Icon */}
                    {tab.icon && (
                      <span 
                        className="flex-shrink-0 transition-transform duration-200"
                        aria-hidden="true"
                      >
                        <span className="block h-3.5 w-3.5">
                          {tab.icon}
                        </span>
                      </span>
                    )}
                    
                    {/* Tab text */}
                    <span className="truncate">
                      {tab.label}
                    </span>
                    
                    {/* Count badge */}
                    {tab.count !== undefined && tab.count > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="ml-1 h-4 px-1.5 text-[10px] font-medium"
                      >
                        {tab.count}
                      </Badge>
                    )}
                    
                    {/* Custom badge */}
                    {tab.badge && (
                      <Badge 
                        variant="outline" 
                        className="ml-1 h-4 px-1.5 text-[10px] font-medium"
                      >
                        {tab.badge}
                      </Badge>
                    )}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Action button area */}
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {/* Rollback button */}
          {canRevert && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              className={cn(
                "h-8 w-8 p-0",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              )}
              title="Revert to this state"
              aria-label="Revert to this state"
            >
              <RollbackIcon className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Expand/collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            onKeyDown={handleKeyDown}
            className={cn(
              "h-8 w-8 p-0",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            )}
            title={isExpanded ? "Collapse content" : "Expand content"}
            aria-label={isExpanded ? "Collapse content" : "Expand content"}
            aria-expanded={isExpanded}
            aria-controls="message-content"
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 