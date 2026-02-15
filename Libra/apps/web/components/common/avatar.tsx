/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * avatar.tsx
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
import * as m from '@/paraglide/messages'

export default function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string
  avatarUrl?: string | null
  className?: string
}) {
  // Generate initials from name if no avatarUrl is provided
  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((letter) => letter?.[0]?.toUpperCase())
        .join('')
    : '?'

  return (
    <div
      className={cn(
        'size-9 rounded-full overflow-hidden bg-gradient-to-t from-neutral-800 to-neutral-600 flex items-center justify-center text-sm font-medium',
        className
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || m["avatar.userAlt"]()}
          width={20}
          height={20}
          className='w-full h-full object-cover'
        />
      ) : (
        initials
      )}
    </div>
  )
}
