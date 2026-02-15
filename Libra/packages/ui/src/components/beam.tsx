/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * beam.tsx
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

const beamVariants = cva(
  "relative after:content-[''] after:absolute after:inset-0 after:rounded-full after:scale-200",
  {
    variants: {
      tone: {
        default:
          'after:bg-radial after:from-foreground/30 after:from-10% after:to-foreground/0 after:to-60%',
        brand: 'after:bg-radial after:from-brand/30 after:from-10% after:to-brand/0 after:to-60%',
        brandLight:
          'after:bg-radial after:from-brand-foreground/30 after:from-10% after:to-brand-foreground/0 after:to-60%',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
)

export interface BeamProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof beamVariants> {}

function Beam({ className, tone, ...props }: BeamProps) {
  return <div data-slot='beam' className={cn(beamVariants({ tone, className }))} {...props} />
}

export { Beam, beamVariants }
