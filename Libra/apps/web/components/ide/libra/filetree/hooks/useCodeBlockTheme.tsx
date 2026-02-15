/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * useCodeBlockTheme.tsx
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

import React from 'react'
import { useTheme } from 'next-themes'

/**
 * Code block theme management hook
 */
export function useCodeBlockTheme() {
  // Get global theme info
  const { resolvedTheme } = useTheme()
  
  // Add manual theme state, default to global theme setting
  const [isDarkMode, setIsDarkMode] = React.useState(
    resolvedTheme === 'dark' ||
    (resolvedTheme === 'system' &&
     typeof window !== 'undefined' &&
     window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
  
  // Listen for global theme changes and sync local theme state
  React.useEffect(() => {
    if (resolvedTheme) {
      setIsDarkMode(resolvedTheme === 'dark')
    }
  }, [resolvedTheme])
  
  return {
    isDarkMode,
    setIsDarkMode
  }
}
