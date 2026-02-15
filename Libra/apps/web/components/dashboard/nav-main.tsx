/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * nav-main.tsx
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

import { type LucideIcon, MailIcon, PlusCircleIcon } from 'lucide-react'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@libra/ui/components/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@libra/ui/components/sidebar'
import { CreateProjectDialog } from './create-project-dialog'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const pathname = usePathname()
  React.useEffect(() => {
  }, [pathname])

  return (
    <SidebarGroup>
      <SidebarGroupContent className='flex flex-col gap-2'>
        <SidebarMenu>
          <SidebarMenuItem className='flex items-center gap-2'>
            <SidebarMenuButton
              tooltip={m["dashboard.create_project"]()}
              className='min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground'
              onClick={() => { setDialogOpen(true); }}
            >
              <PlusCircleIcon />
              <span>{m["dashboard.create_project"]()}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={pathname === item.url}
                className={cn('duration-200 ease-linear')}
              >
                <Link href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
      
      <CreateProjectDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
      />
    </SidebarGroup>
  )
}
