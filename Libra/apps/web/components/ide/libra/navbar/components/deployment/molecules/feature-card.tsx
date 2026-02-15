/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * feature-card.tsx
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

import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface FeatureCardProps {
  title: string
  description: string
  icon: LucideIcon
  expanded?: boolean
  onToggle?: () => void
  children?: React.ReactNode
  className?: string
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  expanded = false,
  onToggle,
  children,
  className
}: FeatureCardProps) {
  const isCollapsible = Boolean(onToggle && children)

  return (
    <div className={cn('deployment-card overflow-hidden', className)}>
      {/* Header */}
      <div 
        className={cn(
          'flex items-center gap-3 p-4',
          isCollapsible && 'cursor-pointer hover:bg-muted/30 transition-colors'
        )}
        onClick={isCollapsible ? onToggle : undefined}
        role={isCollapsible ? 'button' : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={isCollapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle?.()
          }
        } : undefined}
        aria-expanded={isCollapsible ? expanded : undefined}
        aria-controls={isCollapsible ? `feature-content-${title}` : undefined}
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-brand/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        </div>
        
        {isCollapsible && (
          <div className="flex-shrink-0">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Collapsible content */}
      {isCollapsible && (
        <div 
          id={`feature-content-${title}`}
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="px-4 pb-4 border-t border-border/30">
            {children}
          </div>
        </div>
      )}

      {/* Static content */}
      {!isCollapsible && children && (
        <div className="px-4 pb-4 border-t border-border/30">
          {children}
        </div>
      )}
    </div>
  )
}
