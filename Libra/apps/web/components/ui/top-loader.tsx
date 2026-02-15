/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * top-loader.tsx
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
'use client'

import NextTopLoader, { useTopLoader } from 'nextjs-toploader'
import type { NextTopLoaderProps } from 'nextjs-toploader'

// Re-export useTopLoader hook to maintain API compatibility
export { useTopLoader }

export interface TopLoaderProps extends Partial<NextTopLoaderProps> {}

export function TopLoader(props: TopLoaderProps) {
  return (
    <NextTopLoader
      // Use design system brand color for progress bar
      color="var(--color-brand)"
      
      // Initial position slightly adjusted to 15%
      initialPosition={0.15}
      
      // Crawl speed kept at default
      crawlSpeed={200}
      
      // Height set to 4px, slightly thicker for better visibility
      height={4}
      
      // Enable crawl effect
      crawl={true}
      
      // Show loading spinner icon
      showSpinner={true}
      
      // Use standard easing function
      easing="ease"
      
      // Animation speed
      speed={200}
      
      // Use brand color shadow effect
      shadow="0 0 10px var(--color-brand), 0 0 5px var(--color-brand)"
      
      // Set reasonable z-index to ensure visibility
      zIndex={1600}
      
      // Show at top rather than bottom
      showAtBottom={false}
      
      // Override default configuration
      {...props}
    />
  )
} 