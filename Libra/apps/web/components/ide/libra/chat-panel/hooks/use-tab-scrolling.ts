/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-tab-scrolling.ts
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

import { useEffect, useRef, useState } from 'react'

export interface UseTabScrollingReturn {
  tabsContainerRef: React.RefObject<HTMLDivElement | null>
  isScrollable: boolean
  showLeftScroll: boolean
  showRightScroll: boolean
  handleTabsScroll: () => void
  scrollTabs: (direction: 'left' | 'right') => void
}

/**
 * Custom hook for managing tab scrolling functionality
 * Handles scroll state detection and scroll control
 */
export function useTabScrolling(): UseTabScrollingReturn {
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const [isScrollable, setIsScrollable] = useState(false)
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(false)

  const checkScrollable = () => {
    if (tabsContainerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = tabsContainerRef.current
      setIsScrollable(scrollWidth > clientWidth)
      setShowLeftScroll(scrollLeft > 0)
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth)
    }
  }

  const handleTabsScroll = () => {
    if (tabsContainerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = tabsContainerRef.current
      setShowLeftScroll(scrollLeft > 0)
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 2)
    }
  }

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = tabsContainerRef.current.clientWidth / 2
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    checkScrollable()
    window.addEventListener('resize', checkScrollable)

    return () => {
      window.removeEventListener('resize', checkScrollable)
    }
  }, [])

  return {
    tabsContainerRef,
    isScrollable,
    showLeftScroll,
    showRightScroll,
    handleTabsScroll,
    scrollTabs,
  }
}
