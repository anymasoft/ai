/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * theme-switcher.tsx
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

import useIsMounted from '@/lib/hooks/use-is-mounted'
import { Button } from '@libra/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@libra/ui/components/dropdown-menu'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as m from '@/paraglide/messages'

interface ThemeSwitcherProps {
  className?: string
}

const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isMounted = useIsMounted()

  if (!isMounted) {
    return null
  }

  const ICON_SIZE = 16

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={className} asChild>
        <Button
          variant='ghost'
          size='icon'
          className='h-9 w-9 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors'
        >
          {resolvedTheme === 'light' ? (
            <Sun key='light' size={ICON_SIZE} />
          ) : (
            <Moon key='dark' size={ICON_SIZE} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='min-w-[130px]' align='end' sideOffset={8}>
        <DropdownMenuRadioGroup value={theme} onValueChange={(e) => setTheme(e)}>
          <DropdownMenuRadioItem className='flex items-center gap-2' value='light'>
            <Sun className='size-3.5' />
            <span>{m["themeSwitcher.options.light"]()}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className='flex items-center gap-2' value='dark'>
            <Moon className='size-3.5' />
            <span>{m["themeSwitcher.options.dark"]()}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className='flex items-center gap-2' value='system'>
            <Laptop className='size-3.5' />
            <span>{m["themeSwitcher.options.system"]()}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ThemeSwitcher }
