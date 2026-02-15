/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * element-selector.tsx
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
import { SquareDashedMousePointer, Loader2 } from 'lucide-react'
import { Badge } from '@libra/ui/components/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@libra/ui/components/tooltip'
import * as m from '@/paraglide/messages'
import { ElementSelectorState } from '../hooks/use-element-selector'

interface ElementSelectorProps {
  /** Whether the selector is in active state */
  isActive: boolean
  /** Number of selected elements */
  selectedCount?: number
  /** Callback to toggle selection mode */
  onToggle: () => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Whether quota is exceeded */
  quotaExceeded?: boolean
  /** Current state (optional, for external state management) */
  currentState?: ElementSelectorState
  /** Whether the selector is currently activating */
  isActivating?: boolean
  /** Custom CSS class name */
  className?: string
}

/**
 * Smart element selector component
 * Provides intuitive status indication and improved user experience
 */
export const ElementSelector: React.FC<ElementSelectorProps> = ({
  isActive,
  selectedCount = 0,
  onToggle,
  disabled = false,
  quotaExceeded = false,
  currentState: externalState,
  isActivating = false,
  className
}) => {
  // Determine current state (prioritize externally passed state)
  const getCurrentState = (): ElementSelectorState => {
    if (externalState) return externalState
    if (isActivating) return ElementSelectorState.ACTIVATING
    if (!isActive) return ElementSelectorState.INACTIVE
    if (selectedCount > 0) return ElementSelectorState.SELECTING
    return ElementSelectorState.ACTIVE
  }

  const currentState = getCurrentState()

  // Get state-related text and icons
  const getStateContent = () => {
    switch (currentState) {
      case ElementSelectorState.INACTIVE:
        return {
          text: m['chatPanel.toolbar.select_elements'](),
          shortText: 'Select',
          icon: <SquareDashedMousePointer className="h-4 w-4" />,
          showBadge: false
        }
      case ElementSelectorState.ACTIVATING:
        return {
          text: m['chatPanel.elementSelector.stateActivating'](),
          shortText: 'Activating',
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          showBadge: false
        }
      case ElementSelectorState.ACTIVE:
        return {
          text: m['chatPanel.elementSelector.stateActive'](),
          shortText: 'Selecting',
          icon: <SquareDashedMousePointer className="h-4 w-4" />,
          showBadge: false
        }
      case ElementSelectorState.SELECTING:
        return {
          text: m['chatPanel.elementSelector.stateSelecting']({ count: selectedCount }),
          shortText: 'Selected',
          icon: <SquareDashedMousePointer className="h-4 w-4" />,
          showBadge: true
        }
    }
  }

  const stateContent = getStateContent()

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || quotaExceeded) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  // Button style classes
  const buttonClasses = cn(
    // Base styles
    'inline-flex items-center gap-2 h-10 px-4 py-2 rounded-md text-sm font-medium',
    'border transition-all duration-200 ease-in-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',

    // State styles
    currentState === ElementSelectorState.INACTIVE && !quotaExceeded && [
      'border-input bg-background hover:bg-accent hover:text-accent-foreground',
      'text-muted-foreground hover:text-foreground'
    ],

    currentState === ElementSelectorState.ACTIVE && !quotaExceeded && [
      'border-primary bg-primary/10 text-primary',
      'hover:bg-primary/15',
      'animate-pulse shadow-sm shadow-primary/20'
    ],

    currentState === ElementSelectorState.SELECTING && !quotaExceeded && [
      'border-primary bg-primary/5 text-primary',
      'hover:bg-primary/10',
      'ring-1 ring-primary/20'
    ],

    // Disabled state
    (disabled || quotaExceeded) && [
      'opacity-50 cursor-not-allowed',
      'border-muted bg-muted/20 text-muted-foreground'
    ],

    // Focus styles
    'focus-visible:ring-ring dark:focus-visible:ring-offset-background',

    className
  )

  const tooltipContent = quotaExceeded 
    ? m['chatPanel.toolbar.quotaExceededElementSelection']()
    : isActive 
      ? m['chatPanel.toolbar.stop_selecting']()
      : m['chatPanel.toolbar.toggle_element_selector']()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled || quotaExceeded}
          className={buttonClasses}
          role="switch"
          aria-checked={isActive}
          aria-label={tooltipContent}
          aria-describedby={stateContent.showBadge ? 'element-count' : undefined}
        >
          {stateContent.icon}
          
          {/* Desktop: show full text */}
          <span className="hidden sm:inline">
            {stateContent.text}
          </span>

          {/* Mobile: show short text */}
          <span className="sm:hidden">
            {stateContent.shortText}
          </span>

          {/* Count badge */}
          {stateContent.showBadge && selectedCount > 0 && (
            <Badge 
              variant="secondary" 
              className="ml-1 h-5 min-w-5 text-xs"
              id="element-count"
            >
              {selectedCount}
            </Badge>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  )
}
