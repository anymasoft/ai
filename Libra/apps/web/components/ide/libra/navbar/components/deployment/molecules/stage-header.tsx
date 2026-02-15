/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * stage-header.tsx
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

import { StatusIndicator, type StatusType } from '../atoms'
import { cn } from '@libra/ui/lib/utils'

interface StageHeaderProps {
  title: string
  description?: string
  status?: StatusType
  showProgress?: boolean
  className?: string
}

export function StageHeader({
  title,
  description,
  status,
  showProgress = false,
  className
}: StageHeaderProps) {
  return (
    <div className={cn(
      'relative space-y-3 px-6 pt-6 pb-4 border-b border-border/30',
      'bg-gradient-to-b from-background/50 to-transparent',
      className
    )}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          {title}
        </h2>
        {status && (
          <StatusIndicator 
            status={status} 
            size="md"
            showText={false}
          />
        )}
      </div>
      
      {description && (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      )}
      
      {showProgress && (
        <div className="w-full bg-muted/30 rounded-full h-1">
          <div 
            className="bg-gradient-to-r from-primary to-brand h-1 rounded-full transition-all duration-300"
            style={{ width: '100%' }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  )
}
