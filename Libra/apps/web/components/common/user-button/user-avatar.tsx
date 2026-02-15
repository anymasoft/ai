/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * user-avatar.tsx
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

import { Avatar, AvatarFallback, AvatarImage } from '@libra/ui/components/avatar'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import { TIER_INFO } from './constants'
import type { ExtendedUserData, UsageInfo } from './utils'
import { getEmailInitial } from './utils'

interface UserAvatarProps {
  userData: ExtendedUserData
  usageInfo: UsageInfo
  className?: string
}

export function UserAvatar({ userData, usageInfo, className }: UserAvatarProps) {
  const tierInfo = TIER_INFO[usageInfo.tierType]
  const TierIcon = tierInfo.icon

  return (
    <div className="relative">
      <Avatar className={cn("h-8 w-8 border-2 border-border/50 hover:border-primary/60 transition-all duration-200 hover:shadow-sm rounded-full", className)}>
        <AvatarImage
          src={userData.avatarUrl || undefined}
          alt={userData.name || 'User avatar'}
          className="object-cover rounded-full"
          onError={(e) => {
            // Ensure fallback is displayed correctly when image loading fails
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />
        <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-foreground font-medium text-sm rounded-full">
          {getEmailInitial(userData.email || '', userData.name || '')}
        </AvatarFallback>
      </Avatar>
      
      {/* Tier badge */}
      {usageInfo.tierType !== 'FREE' && (
        <div className={cn(
          "absolute -top-0.5 -right-0.5 rounded-full p-0.5 ring-2 ring-background shadow-sm",
          tierInfo.bgColor
        )}>
          <TierIcon className="h-2.5 w-2.5 text-white" />
        </div>
      )}
      
      {/* Usage warning indicator */}
      {usageInfo.usagePercentage > 90 && (
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-destructive p-0.5 ring-2 ring-background shadow-sm animate-pulse">
          <AlertTriangle className="h-2 w-2 text-destructive-foreground" />
        </div>
      )}
    </div>
  )
}