/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * icons.tsx
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

import { memo } from 'react'

interface IconProps {
  className?: string
  size?: number
}

export const StackIcon = memo(({ className, size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' className={className}>
    <path d='M3 14l9 6 9-6M3 8l9 6 9-6M3 2l9 6 9-6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
))
StackIcon.displayName = 'StackIcon'

export const CloseIcon = memo(({ className, size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' className={className}>
    <path d='M18 6L6 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    <path d='M6 6L18 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
))
CloseIcon.displayName = 'CloseIcon'

export const DotsIcon = memo(({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' className={className}>
    <path d='M12 13a1 1 0 100-2 1 1 0 000 2z' fill='currentColor' />
    <path d='M19 13a1 1 0 100-2 1 1 0 000 2z' fill='currentColor' />
    <path d='M5 13a1 1 0 100-2 1 1 0 000 2z' fill='currentColor' />
  </svg>
))
DotsIcon.displayName = 'DotsIcon' 