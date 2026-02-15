/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * footer.tsx
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
import type * as React from 'react'

function Footer({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='footer'
      className={cn('text-foreground pt-12 pb-4', className)}
      {...props}
    />
  )
}

function FooterContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='footer-content'
      className={cn(
        'grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        className
      )}
      {...props}
    />
  )
}

function FooterColumn({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='footer-column' className={cn('flex flex-col gap-4', className)} {...props} />
  )
}

function FooterBottom({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='footer-bottom'
      className={cn(
        'border-border dark:border-border/15 text-muted-foreground mt-8 flex flex-col items-center justify-between gap-4 border-t pt-4 text-xs sm:flex-row',
        className
      )}
      {...props}
    />
  )
}

export { Footer, FooterColumn, FooterBottom, FooterContent }
