/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * plan-overview-card.tsx
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

import { Button } from '@libra/ui/components/button'
import { Card, CardContent } from '@libra/ui/components/card'
import { cn } from '@libra/ui/lib/utils'
import { CreditCard } from 'lucide-react'
import Link from 'next/link'
import * as m from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'

interface PlanOverviewCardProps {
  planName: string
  periodEnd?: Date
  showUpgrade: boolean
  className?: string
}

export function PlanOverviewCard({
  planName,
  periodEnd,
  showUpgrade,
  className,
}: PlanOverviewCardProps) {
  const currentLocale = getLocale()
  const dateLocale = currentLocale === 'zh' ? 'zh-CN' : 'en-US'

  return (
    <Card className={cn('border bg-card', className)}>
      <CardContent className='p-4 lg:p-5'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
          {/* Left: Title and description */}
          <div className='flex items-center gap-3'>
            <CreditCard className='h-5 w-5 text-muted-foreground' />
            <div>
              <h1 className='text-lg lg:text-xl font-semibold text-foreground'>
                {m['dashboard.billing.title']()}
              </h1>
              <p className='text-sm text-muted-foreground'>{m['dashboard.billing.subtitle']()}</p>
            </div>
          </div>

          {/* Right: Plan info and upgrade button */}
          <div className='flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3'>
            {/* Current plan info */}
            <div className='flex flex-col items-start lg:items-end gap-1'>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium text-foreground'>
                  {m['dashboard.billing.currentPlan.plan']({ plan: planName })}
                </span>
              </div>

              {periodEnd && (
                <p className='text-xs text-muted-foreground'>
                  {m['dashboard.billing.currentPlan.billingPeriodEnd']({
                    date: periodEnd.toLocaleDateString(dateLocale),
                  })}
                </p>
              )}
            </div>

            {/* Upgrade button */}
            {showUpgrade && (
              <Button variant='outline' size='sm' asChild>
                <Link href='/#price'>{m['dashboard.billing.upgradePlan']()}</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
