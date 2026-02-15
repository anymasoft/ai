/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * usage-display.tsx
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

import { Card, CardContent } from '@libra/ui/components/card'
import { Progress } from '@libra/ui/components/progress'
import { Badge } from '@libra/ui/components/badge'
import { Button } from '@libra/ui/components/button'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import { TIER_INFO } from './constants'
import type { UsageInfo, ExtendedUserData } from './utils'
import * as m from '@/paraglide/messages'

interface UsageDisplayProps {
  usageInfo: UsageInfo
  userData: ExtendedUserData
  usageData: any
  isUsageLoading: boolean
  onUpgrade: () => void
}

export function UsageDisplay({ usageInfo, userData, usageData, isUsageLoading, onUpgrade }: UsageDisplayProps) {
  const tierInfo = TIER_INFO[usageInfo.tierType]
  const TierIcon = tierInfo.icon

  return (
    <div className="p-4">
      <Card className="border-0 shadow-none glass-2">
        <CardContent className="p-4 space-y-4">
          {/* Tier title area */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg border",
                `${tierInfo.bgColor}/10 ${tierInfo.borderColor}/20`
              )}>
                <TierIcon className={cn("h-4 w-4", tierInfo.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", tierInfo.color)}>
                    {tierInfo.label}
                  </span>
                  {usageInfo.hasMultiplePlans && (
                    <Badge variant={tierInfo.badgeVariant} className="text-xs px-2 py-0.5">
                      {m["userButton.usageDisplay.hybridPlan"]()}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tierInfo.description}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={onUpgrade}
            >
              {usageInfo.tierType === 'FREE' ? m["common.user_menu.upgrade"]() : m["common.user_menu.manage"]()}
            </Button>
          </div>
          
          {/* AI usage status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{m["common.user_menu.ai_usage"]()}</span>
              <div className="text-right">
                <div className={cn(
                  "text-sm font-semibold",
                  usageInfo.usagePercentage > 90 ? "text-destructive" : tierInfo.color
                )}>
                  {isUsageLoading ? m["common.user_menu.loading"]() : `${usageInfo.currentUsage}/${usageInfo.totalLimit}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m["common.user_menu.remaining"]({ count: usageInfo.remainingUsage || 0 })}
                </div>
              </div>
            </div>

            <Progress
              value={usageInfo.usagePercentage}
              className={cn(
                "h-2",
                usageInfo.usagePercentage > 90
                  ? "[&>div]:bg-destructive"
                  : usageInfo.usagePercentage > 75
                    ? "[&>div]:bg-yellow-500"
                    : `[&>div]:bg-gradient-to-r [&>div]:${tierInfo.gradientFrom} [&>div]:${tierInfo.gradientTo}`
              )}
            />
            
            {/* Usage status alerts */}
            {usageInfo.usagePercentage > 90 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                <span className="text-xs text-destructive font-medium">{m["userButton.usageDisplay.usageAlmostExhausted"]()}</span>
              </div>
            )}
            {usageInfo.usagePercentage > 75 && usageInfo.usagePercentage <= 90 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-3 w-3 text-yellow-600 shrink-0" />
                <span className="text-xs text-yellow-700 font-medium">{m["userButton.usageDisplay.usageHigh"]()}</span>
              </div>
            )}
          </div>

          {/* Plan details */}
          {usageInfo.hasMultiplePlans && usageData && usageData.planDetails && (
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground mb-2">{m["userButton.usageDisplay.planDetails"]()}</div>
              {usageData.planDetails.paid && (
                <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                  <span className="text-xs font-medium text-foreground">{m["userButton.usageDisplay.paidPlan"]()}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {Math.max(0, usageData.planDetails.paid.aiNumsLimit - usageData.planDetails.paid.aiNums)}/{usageData.planDetails.paid.aiNumsLimit}
                  </span>
                </div>
              )}
              {usageData.planDetails.free && (
                <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                  <span className="text-xs font-medium text-foreground">{m["userButton.usageDisplay.freeQuota"]()}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {Math.max(0, usageData.planDetails.free.aiNumsLimit - usageData.planDetails.free.aiNums)}/{usageData.planDetails.free.aiNumsLimit}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}