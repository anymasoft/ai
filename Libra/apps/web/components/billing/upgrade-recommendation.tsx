/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * upgrade-recommendation.tsx
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
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import * as m from '@/paraglide/messages'

interface UpgradeRecommendationProps {
  planName: string
  hasUrgentIssues: boolean
  className?: string
}

export function UpgradeRecommendation({
  planName,
  hasUrgentIssues,
  className,
}: UpgradeRecommendationProps) {
  // Don't show for MAX plan
  if (planName === 'MAX') {
    return null
  }

  // Urgent upgrade banner for critical issues
  if (hasUrgentIssues) {
    return (
      <Card
        className={cn(
          'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20',
          className
        )}
      >
        <CardContent className='p-4'>
          <div className='flex items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <AlertTriangle className='h-4 w-4 text-amber-600' />
              <div>
                <h3 className='font-medium text-sm text-amber-900 dark:text-amber-100'>
                  {m['dashboard.billing.upgrade.title']()}
                </h3>
                <p className='text-xs text-amber-700 dark:text-amber-200'>
                  {m['dashboard.billing.upgrade.resourcesRunningOut']()}
                </p>
              </div>
            </div>
            <Button variant='outline' size='sm' asChild>
              <Link href='/#price'>{m['dashboard.billing.upgrade.button']()}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Regular upgrade recommendation
  return (
    <Card className={cn('border bg-card', className)}>
      <CardContent className='p-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <div>
            <h3 className='font-medium text-sm text-foreground'>
              {m['dashboard.billing.upgrade.title']()}
            </h3>
            <p className='text-xs text-muted-foreground mt-1'>
              {m['dashboard.billing.upgrade.description']()}
            </p>
          </div>

          <Button variant='outline' size='sm' asChild>
            <Link href='/#price'>{m['dashboard.billing.upgrade.viewPlans']()}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
