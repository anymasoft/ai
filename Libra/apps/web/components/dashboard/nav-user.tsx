/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * nav-user.tsx
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

import {
  BellIcon,
  CreditCardIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  MoreVerticalIcon,
  SettingsIcon,
  SunIcon,
  UserCircleIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@libra/auth/auth-client'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@libra/ui/components/avatar'
import { Badge } from '@libra/ui/components/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@libra/ui/components/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@libra/ui/components/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@libra/ui/components/tooltip'
import * as m from '@/paraglide/messages'

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
    status?: 'online' | 'away' | 'offline'
    notificationCount?: number
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  
  // Default values if not provided
  const status = user.status || 'online'
  const notificationCount = user.notificationCount || 0

  // Initialize theme settings
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        setIsDark(true)
        document.documentElement.classList.add('dark')
      } else {
        setIsDark(false)
        document.documentElement.classList.remove('dark')
      }
      
      // Log theme initialization
    } catch (error) {
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-amber-500'
      case 'offline':
        return 'bg-gray-400'
      default:
        return 'bg-green-500'
    }
  }

  // Handle theme toggle
  const toggleTheme = () => {
    if (!isLoaded) return

    setIsLoaded(false)
    const newTheme = !isDark
    setIsDark(newTheme)

    try {
      if (newTheme) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
      
      // Log theme change
    } catch (error) {
    }

    // Debounce delay
    setTimeout(() => setIsLoaded(true), 300)
  }

  // Handle navigation to session page
  const handleNavigateToSession = () => {
    router.push('/dashboard/session')
  }

  // Handle navigation to billing page
  const handleNavigateToBilling = () => {
    router.push('/dashboard/billing')
  }

  // Handle sign out
  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login")
          },
        },
      })
    } catch (error) {
      toast.error(m['dashboard.navUser.logoutFailed']())
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <TooltipProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='group relative data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors duration-200'
              >
                <div className="relative">
                  <Avatar className='h-8 w-8 rounded-lg ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300'>
                    <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />
                    <AvatarFallback className='rounded-lg bg-primary/10 text-primary font-semibold'>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ${getStatusColor()} ring-2 ring-white`} />
                </div>
                <span className='truncate text-xs text-muted-foreground'>{user.email}</span>

                {notificationCount > 0 && (
                  <Badge variant="destructive" className="ml-auto mr-1 px-1.5 py-0.5 text-xs">
                    {notificationCount}
                  </Badge>
                )}
                <MoreVerticalIcon className='size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 rounded-lg shadow-lg backdrop-blur-sm border-border/40'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={8}
              alignOffset={-5}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-3 p-3 text-left text-sm border-b border-border/20'>
                  <div className="relative">
                    <Avatar className='h-10 w-10 rounded-lg'>
                      <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />
                      <AvatarFallback className='rounded-lg bg-primary/10 text-primary font-semibold'>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ${getStatusColor()} ring-2 ring-white cursor-pointer`} />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="capitalize">{status}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='font-medium text-base'>{user.name}</span>
                    <span className='text-xs text-muted-foreground'>{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <div className="p-2">
                <DropdownMenuGroup>
                  {/* <DropdownMenuItem className="cursor-pointer rounded-md transition-colors hover:bg-accent/80">
                    <UserCircleIcon className="mr-2 h-4 w-4" />
                    <span>{m['dashboard.navUser.profile']()}</span>
                  </DropdownMenuItem> */}
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md transition-colors hover:bg-accent/80"
                    onClick={handleNavigateToSession}
                  >
                    <MonitorSmartphoneIcon className="mr-2 h-4 w-4" />
                    <span>{m['dashboard.navUser.session']()}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md transition-colors hover:bg-accent/80"
                    onClick={handleNavigateToBilling}
                  >
                    <CreditCardIcon className="mr-2 h-4 w-4" />
                    <span>{m['dashboard.navUser.billing']()}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem 
                    className="cursor-pointer rounded-md transition-colors hover:bg-accent/80" 
                    onClick={toggleTheme}
                    disabled={!isLoaded}
                  >
                    <div className="relative mr-2 h-4 w-4">
                      <SunIcon className={`absolute inset-0 h-full w-full transition-all duration-300 ${
                        isDark ? 'transform opacity-100 rotate-0' : 'transform opacity-0 rotate-90'
                      }`} />
                      <MoonIcon className={`absolute inset-0 h-full w-full transition-all duration-300 ${
                        isDark ? 'transform opacity-0 -rotate-90' : 'transform opacity-100 rotate-0'
                      }`} />
                    </div>
                    <span>{isDark ? m['dashboard.navUser.switchToLight']() : m['dashboard.navUser.switchToDark']()}</span>
                  </DropdownMenuItem>
                  {/* <DropdownMenuItem className="cursor-pointer rounded-md transition-colors hover:bg-accent/80">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>{m['dashboard.navUser.settings']()}</span>
                  </DropdownMenuItem> */}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer rounded-md text-destructive transition-colors hover:bg-destructive/10"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  <span>{isSigningOut ? m['dashboard.navUser.loggingOut']() : m['dashboard.navUser.logout']()}</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </TooltipProvider>
  )
}
