/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * input-styles.ts
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

// Input container styles
export const getInputContainerStyles = () => cn(
  'group relative transition-all duration-300 ease-in-out rounded-lg shadow-sm overflow-hidden',
  'ring-1 ring-blue-500/20 bg-foreground/5',
  'hover:ring-primary/30 hover:bg-foreground/5',
  'focus-within:ring-2 focus-within:ring-primary/30 focus-within:bg-gradient-to-br focus-within:from-background/90 focus-within:to-background/70'
)

// Text area styles
export const getTextareaStyles = () => cn(
  'w-full resize-none border-none focus-visible:ring-0 p-0',
  'min-h-[60px] max-h-[250px] text-sm disabled:opacity-60',
  'outline-none focus:outline-none focus-visible:outline-none',
  'shadow-none focus:shadow-none !ring-0 !ring-offset-0',
  'bg-transparent placeholder:text-gray-400'
)

// Character count styles
export const getCharCountStyles = (messageLength: number, maxLength: number) => cn(
  'text-xs px-3 py-1 text-right transition-colors',
  'dark:border-neutral-700 border-t border-t-border/10 border-gray-200',
  messageLength > maxLength
    ? 'dark:text-red-400 text-red-500 font-medium'
    : messageLength > maxLength * 0.9
      ? 'dark:text-amber-400 text-amber-500'
      : 'dark:text-neutral-400 text-gray-500'
)

// Loading state styles
export const getLoadingIndicatorStyles = () => cn(
  'mb-2 flex items-center gap-2 text-xs sm:text-sm text-fg-subtle',
  'animate-in fade-in slide-in-from-bottom-2 duration-300'
)

export const getLoadingSpanStyles = () => cn(
  'flex items-center gap-1.5 py-1 px-2 rounded-full bg-muted/20 ring-1 ring-border/30',
  'dark:text-gray-300 dark:bg-gray-800/50 dark:ring-gray-700/50'
) 