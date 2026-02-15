/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * action-card.tsx
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

import { Loader2 } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'

interface ActionCardProps {
  title: string
  description: string
  buttonText: string
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost'
  buttonSize?: 'sm' | 'default' | 'lg'
  isLoading?: boolean
  disabled?: boolean
  onClick: () => void
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function ActionCard({
  title,
  description,
  buttonText,
  buttonVariant = 'default',
  buttonSize = 'sm',
  isLoading = false,
  disabled = false,
  onClick,
  icon,
  children,
  className
}: ActionCardProps) {
  return (
    <div className={cn('p-6 border border-border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow duration-200', className)}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-semibold text-foreground leading-tight">{title}</h4>
            <p className="text-muted-foreground mt-2 leading-relaxed">{description}</p>
          </div>
          <Button
            variant={buttonVariant}
            size={buttonSize}
            onClick={onClick}
            disabled={disabled || isLoading}
            className="flex-shrink-0 min-w-fit"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                {icon && <span className="mr-2">{icon}</span>}
                {buttonText}
              </>
            )}
          </Button>
        </div>
        {children && (
          <div className="pt-4 border-t border-border/50">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
