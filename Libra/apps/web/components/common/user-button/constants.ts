/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * constants.ts
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

import { Crown, Sparkles, Zap } from 'lucide-react'
import * as m from '@/paraglide/messages'

// Tier information configuration - using design system semantic colors
export const getTierInfo = () => ({
  FREE: {
    label: m["common.user_tiers.free"](),
    description: m["common.user_tiers.free_desc"](),
    icon: Zap,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    gradientFrom: 'from-muted',
    gradientTo: 'to-muted/80',
    borderColor: 'border-border',
    badgeVariant: 'secondary' as const,
  },
  PRO: {
    label: m["common.user_tiers.pro"](),
    description: m["common.user_tiers.pro_desc"](),
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary',
    gradientFrom: 'from-primary',
    gradientTo: 'to-primary/80',
    borderColor: 'border-primary',
    badgeVariant: 'default' as const,
  },
  MAX: {
    label: m["common.user_tiers.max"](),
    description: m["common.user_tiers.max_desc"](),
    icon: Crown,
    color: 'text-brand',
    bgColor: 'bg-brand',
    gradientFrom: 'from-brand',
    gradientTo: 'to-brand/80',
    borderColor: 'border-brand',
    badgeVariant: 'default' as const,
  },
} as const)

// Type definitions for backward compatibility
export type TierInfo = ReturnType<typeof getTierInfo>
export type TierType = keyof TierInfo

// Keep TIER_INFO export for backward compatibility
export const TIER_INFO = getTierInfo()