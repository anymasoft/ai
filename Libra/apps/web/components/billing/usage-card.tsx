/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * usage-card.tsx
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

import { type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@libra/ui/components/card'
import { cn } from '@libra/ui/lib/utils'
import { type UsageStatus } from './status-indicator'
import * as m from '@/paraglide/messages'

interface UsageCardProps {
  icon: LucideIcon
  title: string
  used: number
  total: number
  description: string
  status: UsageStatus
  actionButton?: React.ReactNode
  className?: string
}

export function UsageCard({
  icon: Icon,
  title,
  used,
  total,
  description,
  status,
  actionButton,
  className
}: UsageCardProps) {
  const remaining = Math.max(0, total - used)

  // Simplified binary status: normal or insufficient
  const isInsufficient = remaining <= 0 || status === 'danger'

  return (
    <Card className={cn(
      'border bg-card hover:bg-accent/5 transition-colors',
      className
    )}>
      <CardContent className="p-4">
        {/* Simplified header - removed planType display */}
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground flex-1">{title}</h3>
        </div>

        {/* Simplified usage display */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className={cn(
                'text-lg font-semibold',
                isInsufficient ? 'text-destructive' : 'text-foreground'
              )}>
                {used.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                / {total.toLocaleString()}
              </span>
            </div>
            {isInsufficient && (
              <span className="text-xs text-destructive font-medium">
                {m['dashboard.billing.usage.insufficient']()}
              </span>
            )}
          </div>

          {/* Simplified description */}
          <p className="text-xs text-muted-foreground">
            {description}
          </p>

          {/* Action button */}
          {actionButton && (
            <div className="pt-2">
              {actionButton}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Simplified compact version for quick stats
export function UsageCardCompact({
  icon: Icon,
  title,
  value,
  status,
  className
}: {
  icon: LucideIcon
  title: string
  value: string | number
  status: UsageStatus
  className?: string
}) {
  const getTextColor = () => {
    if (status === 'danger') return 'text-destructive'
    return 'text-foreground'
  }

  return (
    <div className={cn('text-center space-y-2', className)}>
      <Icon className="h-4 w-4 text-muted-foreground mx-auto" />
      <div className={cn('text-lg font-semibold', getTextColor())}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-muted-foreground">{title}</div>
    </div>
  )
}
