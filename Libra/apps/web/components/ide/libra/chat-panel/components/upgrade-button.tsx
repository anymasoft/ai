/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * upgrade-button.tsx
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

import * as m from '@/paraglide/messages'
import { Button } from '@libra/ui/components/button'
import { Card, CardContent } from '@libra/ui/components/card'
import { cn } from '@libra/ui/lib/utils'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@libra/auth/auth-client'

interface UpgradeButtonProps {
  className?: string
  onUpgrade?: () => void
}

export const UpgradeButton = ({ className, onUpgrade }: UpgradeButtonProps) => {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const handleUpgradeClick = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      router.push('/#price')
    }
  }

  return (
    <Card className={cn(
      'border-2 border-dashed border-orange-200 dark:border-orange-800/50',
      'bg-gradient-to-r from-orange-50/50 to-amber-50/50',
      'dark:from-orange-950/20 dark:to-amber-950/20',
      'transition-all duration-300 hover:shadow-md',
      'animate-pulse',
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Icon and message */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                'bg-gradient-to-br from-orange-400 to-amber-500',
                'text-white shadow-lg'
              )}>
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">
                {m["chatPanel.errors.quotaExceeded"]()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {m["chatPanel.errors.quotaExceededDesc"]()}
              </p>
            </div>
          </div>

          {/* Right side: Upgrade button */}
          <div className="flex-shrink-0">
            <Button
              onClick={handleUpgradeClick}
              size="sm"
              className={cn(
                'bg-gradient-to-r from-orange-500 to-amber-500',
                'hover:from-orange-600 hover:to-amber-600',
                'text-white font-medium',
                'shadow-lg hover:shadow-xl',
                'transition-all duration-200',
                'group'
              )}
            >
              <span className="mr-2">{m["chatPanel.errors.upgradeButton"]()}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>

        {/* Optional: Progress bar or additional info */}
        <div className="mt-3 pt-3 border-t border-orange-200/50 dark:border-orange-800/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{m['ide.upgrade.quotaStatus']()}</span>
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {m['ide.upgrade.quotaRemaining']()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for smaller spaces
export const CompactUpgradeButton = ({ className, onUpgrade }: UpgradeButtonProps) => {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const handleUpgradeClick = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      if (session?.user) {
        const username = (session.user as any)?.username || session.user.id
        router.push(`/@${username}`)
      } else {
        router.push('/#price')
      }
    }
  }

  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg',
      'border border-orange-200 dark:border-orange-800/50',
      'bg-gradient-to-r from-orange-50/80 to-amber-50/80',
      'dark:from-orange-950/30 dark:to-amber-950/30',
      'transition-all duration-200',
      className
    )}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-medium text-foreground">
          {m["chatPanel.upgrade.quotaExceededShort"]()}
        </span>
      </div>
      <Button
        onClick={handleUpgradeClick}
        size="sm"
        variant="outline"
        className={cn(
          'border-orange-300 text-orange-700 hover:bg-orange-100',
          'dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30',
          'text-xs px-3 py-1'
        )}
      >
        {m["chatPanel.upgrade.upgrade"]()}
      </Button>
    </div>
  )
}
