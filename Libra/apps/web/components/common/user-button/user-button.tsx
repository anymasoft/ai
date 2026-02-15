/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * user-button.tsx
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

import { authClient, signOut } from '@libra/auth/auth-client'
import { Avatar, AvatarFallback } from '@libra/ui/components/avatar'
import { Button } from '@libra/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@libra/ui/components/dropdown-menu'
import { LayoutDashboard, LogOut, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMembershipStatus } from '@/hooks/use-membership-status'
import * as m from '@/paraglide/messages'
import { UsageDisplay } from './usage-display'
import { UserAvatar } from './user-avatar'
import type { ExtendedUserData } from './utils'
import { getUsageInfo } from './utils'

export default function UserButton() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const { data: session, isPending } = authClient.useSession()

  // Use unified membership status hook
  const { membershipStatus, isLoading: isUsageLoading, handleUpgrade } = useMembershipStatus()

  // Show loading state - more robust check
  if (isPending || !session || !session.user) {
    return (
      <Avatar className='h-8 w-8 border-2 border-border/50 rounded-full'>
        <AvatarFallback className='bg-gradient-to-br from-primary/10 to-primary/5 animate-pulse rounded-full'>
          <UserIcon className='h-4 w-4 text-muted-foreground' />
        </AvatarFallback>
      </Avatar>
    )
  }

  // Get user data - add safety checks
  const userData: ExtendedUserData = {
    ...session.user,
    username: (session.user as any)?.username || session.user.id,
    avatarUrl: session.user.image || '',
    // Ensure email and name exist
    email: session.user.email || '',
    name: session.user.name || session.user.email || 'User',
  }

  // Convert membership status to legacy usage info format for compatibility
  const usageData = membershipStatus
    ? {
        plan: membershipStatus.plan,
        aiNums: membershipStatus.usage.aiNums,
        aiNumsLimit: membershipStatus.usage.aiNumsLimit,
        projectNums: membershipStatus.usage.projectNums,
        projectNumsLimit: membershipStatus.usage.projectNumsLimit,
        seats: membershipStatus.usage.seats,
        seatsLimit: membershipStatus.usage.seatsLimit,
        planDetails: {
          paid: membershipStatus.isPremium
            ? {
                plan: membershipStatus.plan,
                aiNums: membershipStatus.usage.aiNums,
                aiNumsLimit: membershipStatus.usage.aiNumsLimit,
              }
            : null,
          free: !membershipStatus.isPremium
            ? {
                plan: membershipStatus.plan,
                aiNums: membershipStatus.usage.aiNums,
                aiNumsLimit: membershipStatus.usage.aiNumsLimit,
              }
            : null,
        },
      }
    : null

  const usageInfo = getUsageInfo(usageData, isUsageLoading)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='relative h-auto w-auto rounded-full p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          aria-label={`${m['common.user_menu.user_menu_label']()} - ${userData.name}`}
        >
          <UserAvatar userData={userData} usageInfo={usageInfo} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className='w-80 p-0 shadow-lg border-border' align='end' sideOffset={8}>
        {/* User info header */}
        <div className='p-4 border-b border-border bg-card'>
          <div className='flex items-center gap-3'>
            <UserAvatar userData={userData} usageInfo={usageInfo} className='h-10 w-10' />
            <div className='flex-1 min-w-0'>
              <div className='font-medium text-foreground truncate'>{userData.name}</div>
              <div className='text-sm text-muted-foreground truncate'>{userData.email}</div>
            </div>
          </div>
        </div>

        {/* Navigation menu */}
        <div className='p-1'>
          <DropdownMenuItem asChild>
            <Link
              href='/dashboard'
              className='flex items-center gap-3 px-3 py-2 text-sm cursor-pointer rounded-sm hover:bg-accent focus:bg-accent'
            >
              <LayoutDashboard className='h-4 w-4 text-muted-foreground' />
              <span>{m['userButton.navigation.dashboard']()}</span>
            </Link>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        {/* Usage display area */}
        <UsageDisplay
          usageInfo={usageInfo}
          userData={userData}
          usageData={usageData}
          isUsageLoading={isUsageLoading}
          onUpgrade={handleUpgrade}
        />

        <DropdownMenuSeparator />

        {/* Logout button */}
        <div className='p-1'>
          <DropdownMenuItem
            onClick={() => signOut()}
            className='flex items-center gap-3 px-3 py-2 text-sm cursor-pointer rounded-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
          >
            <LogOut className='h-4 w-4' />
            <span>{m['userButton.actions.logOut']()}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
