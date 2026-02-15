/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * badge.tsx
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

import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-border/100 dark:border-border/80 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 gap-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground dark:shadow-sm',
        brand: 'border-transparent bg-brand text-primary-foreground dark:shadow-sm',
        secondary: 'border-transparent bg-secondary text-secondary-foreground dark:shadow-sm',
        destructive: 'border-transparent bg-destructive text-destructive-foreground dark:shadow-sm',
        outline: 'text-foreground',
      },
      size: {
        default: 'px-2.5 py-1',
        sm: 'px-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div data-slot='badge' className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
