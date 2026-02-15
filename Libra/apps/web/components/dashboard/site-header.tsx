/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * site-header.tsx
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

"use client"

import { Separator } from '@libra/ui/components/separator'
import { SidebarTrigger } from '@libra/ui/components/sidebar'
import * as m from '@/paraglide/messages'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeSwitcher } from '@/components/common/theme-switcher'

export function SiteHeader() {
  return (
    <header className='group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear'>
      <div className='flex w-full items-center justify-between px-3 sm:px-4 lg:px-6'>
        <div className='flex items-center gap-1 lg:gap-2'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mx-2 data-[orientation=vertical]:h-4' />
          <h1 className='text-sm sm:text-base font-medium'>{m["dashboard.siteHeader.projectManagement"]()}</h1>
        </div>
        <div className='flex items-center gap-1 sm:gap-2'>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}
