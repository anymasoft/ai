/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

import type { ReactNode } from 'react'
import type { PricingColumnProps } from './components/pricing-column'

export type Plan = {
  id: string
  name: string
  description: string
  icon?: ReactNode
  monthlyPrice: number
  yearlyPrice: number
  seats: number
  cta: {
    variant: 'glow' | 'default'
    label: string
    href?: string
    onClick?: () => Promise<void>
  }
  features?: string[]
  marketingFeatures: string[]
  variant?: PricingColumnProps['variant']
  isEnterprise?: boolean
  isCurrentPlan?: boolean
}

export interface ApiPlan {
  id: string
  name: string
  description?: string
  group?: string
  seats?: number
  features?: string[]
  marketingFeatures?: string[]
  monthlyPrice?: number
  yearlyPrice?: number
  variant?: string
  cta?: {
    variant: 'glow' | 'default'
    label: string
    href: string
  }
  isEnterprise?: boolean
  isCurrentPlan?: boolean
}

export interface PricingProps {
  title?: string
  description?: string
  yearlyDiscount?: number
  plans?: Plan[]
  className?: string
  showEnterprise?: boolean
}