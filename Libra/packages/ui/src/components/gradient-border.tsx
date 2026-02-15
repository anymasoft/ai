/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * gradient-border.tsx
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
import { forwardRef, type ReactNode } from 'react'

interface GradientBorderProps {
  children: ReactNode
  wrapperClassName?: string
  className?: string
  gradientFrom?: string
  gradientVia?: string
  gradientTo?: string
  direction?:
    | 'bg-gradient-to-t'
    | 'bg-gradient-to-tr'
    | 'bg-gradient-to-r'
    | 'bg-gradient-to-br'
    | 'bg-gradient-to-b'
    | 'bg-gradient-to-bl'
    | 'bg-gradient-to-l'
    | 'bg-gradient-to-tl'
}

export const GradientBorder = forwardRef<HTMLDivElement, GradientBorderProps>(
  (
    {
      children,
      wrapperClassName,
      className,
      gradientFrom = 'from-border-100',
      gradientVia = 'via-border-200',
      gradientTo = 'to-transparent',
      direction = 'bg-gradient-to-b',
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'transform-gpu rounded-[1px] p-[0.5px]',
          direction,
          gradientFrom,
          gradientVia,
          gradientTo,
          wrapperClassName
        )}
      >
        <div className={cn('rounded-[1px] ', className)}>{children}</div>
      </div>
    )
  }
)

GradientBorder.displayName = 'GradientBorder'
