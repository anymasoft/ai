/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * mode-toggle.tsx
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

import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { Button } from '@libra/ui/components/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@libra/ui/components/tooltip'
import * as m from '@/paraglide/messages'

export function ModeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <TooltipProvider disableHoverableContent>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            className='rounded-full w-8 h-8 bg-background mr-2'
            variant='outline'
            size='icon'
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <SunIcon className='w-[1.2rem] h-[1.2rem] transition-transform ease-in-out duration-500 transform dark:rotate-0 dark:scale-100 rotate-90 scale-0' />
            <MoonIcon className='absolute w-[1.2rem] h-[1.2rem] transition-transform ease-in-out duration-500 transform rotate-0 scale-100 dark:-rotate-90 dark:scale-0' />
            <span className='sr-only'>{m["common.theme_toggle"]()}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side='bottom'>{m["common.theme_toggle"]()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
