/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * frame.tsx
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

import { cn } from '@libra/ui/lib/utils'
import Scanline from './scanline'

interface FrameProps {
  children: React.ReactNode
  classNames?: {
    wrapper?: string
    frame?: string
  }
}

export default function Frame({ children, classNames }: FrameProps) {
  return (
    <div
      className={cn('relative flex h-fit w-fit pb-1.5', classNames?.wrapper)}
    >
      <div className="absolute inset-x-[3px] top-1 bottom-0 h-auto w-auto rounded-xs border">
        <Scanline />
      </div>
      <div
        className={cn(
          ' relative w-full rounded-xs border shadow-md',
          classNames?.frame
        )}
      >
        {children}
      </div>
    </div>
  )
}
