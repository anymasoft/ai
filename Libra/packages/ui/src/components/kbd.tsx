/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * kbd.tsx
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

import * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { Badge } from './badge'

interface KbdProps {
  keys: string[]
  className?: string
}

export function Kbd({ keys, className }: KbdProps) {
  const [isMac, setIsMac] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check platform
    setIsMac(navigator.platform.toLowerCase().includes('mac'))
    // Basic mobile detection
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  if (isMobile) {
    return null
  }

  const formatKey = (key: string) => {
    switch (key.toLowerCase()) {
      case 'cmd':
      case 'command':
        return isMac ? '⌘' : 'Ctrl'
      case 'option':
      case 'alt':
        return isMac ? '⌥' : 'Alt'
      case 'shift':
        return isMac ? '⇧' : 'Shift'
      default:
        return key.toUpperCase()
    }
  }

  const isSymbolKey = (key: string) => {
    const symbolKeys = ['cmd', 'command', 'option', 'alt', 'shift']
    return symbolKeys.includes(key.toLowerCase())
  }

  // if the key is a symbol key, we scale it up
  return (
    <Badge className={cn('pointer-events-none', className)}>
      {keys.map((key, index) => {
        const formattedKey = formatKey(key)
        return (
          <React.Fragment key={key}>
            {index > 0 && '+'}
            {isMac && isSymbolKey(key) ? (
              <span className='scale-[1.4]'>{formattedKey}</span>
            ) : (
              formattedKey
            )}
          </React.Fragment>
        )
      })}
    </Badge>
  )
}
