/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * theme-switcher.tsx
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

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export const ThemeSwitcher = () => {
  const [isDark, setIsDark] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        setIsDark(true)
        document.documentElement.classList.add('dark')
      } else {
        setIsDark(false)
        document.documentElement.classList.remove('dark')
      }
    } catch (error) {
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const toggleTheme = () => {
    if (!isLoaded) return

    setIsLoaded(false)
    const newTheme = !isDark
    setIsDark(newTheme)

    try {
      if (newTheme) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    } catch (error) {
    }

    // Debounce delay
    setTimeout(() => setIsLoaded(true), 300)
  }

  return (
    <button
      onClick={toggleTheme}
      className='w-10 h-10 rounded-full flex items-center justify-center hover:/10 text-gray-700 hover: transition-all duration-300'
      type='button'
      aria-label='Toggle theme'
      disabled={!isLoaded}
    >
      <div className='relative w-5 h-5'>
        <Sun
          className={`absolute inset-0 h-full w-full transition-all duration-300 ${
            isDark ? 'transform opacity-100 rotate-0' : 'transform opacity-0 rotate-90'
          }`}
        />
        <Moon
          className={`absolute inset-0 h-full w-full transition-all duration-300 ${
            isDark ? 'transform opacity-0 -rotate-90' : 'transform opacity-100 rotate-0'
          }`}
        />
      </div>
    </button>
  )
}
