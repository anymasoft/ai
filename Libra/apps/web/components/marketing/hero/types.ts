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
import type { ButtonProps } from '../../ui/button'

// Hero button properties
export interface HeroButtonProps {
  href: string
  text: string
  variant?: ButtonProps['variant']
  icon?: ReactNode
  iconRight?: ReactNode
}

// Hero component main properties
export interface HeroProps {
  title?: string
  description?: string
  mockup?: ReactNode | false
  badge?: ReactNode | false
  buttons?: HeroButtonProps[] | false
  className?: string
}

// Example category
export interface ExampleCategory {
  id: string
  name: string
  icon: ReactNode
  color: string
  examples: Example[]
}

// Example item
interface Example {
  title: string
  description: string
  preview: string
}

// Feedback information
export interface Feedback {
  show: boolean
  message: string
  type: string
}

// Typewriter effect timer references
export interface ActiveTimers {
  typingIntervals: NodeJS.Timeout[]
  erasingIntervals: NodeJS.Timeout[]
  pauseTimers: NodeJS.Timeout[]
  baseAnimation: any
} 