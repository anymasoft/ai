/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * layout-wrapper.tsx
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

import Index from '@/components/ide/index'
import Navbar from '@/components/ide/libra/navbar'
import { useEffect, useState } from 'react'
import type React from 'react'
import { authClient } from '@libra/auth/auth-client'
import { useTRPC } from '@/trpc/client'
import { useQuery } from '@tanstack/react-query'

/**
 * IDE Layout
 *
 */
export default function LayoutWrapper({
  children,
  codePreviewActive,
}: {
  children: React.ReactNode
  codePreviewActive: boolean
}) {
  // Authentication and tRPC setup
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const trpc = useTRPC()

  // Get user's subscription usage data
  const {
    data: usageData,
    isLoading: isUsageLoading,
  } = useQuery(
    trpc.subscription.getUsage.queryOptions(
      {},
      {
        enabled: !!activeOrganization?.id,
        refetchInterval: 30000,
      }
    )
  )

  // State management
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [codePreviewActiveState, setCodePreviewActiveState] = useState(codePreviewActive)
  // Add fullscreen state management
  const [isFullScreen, setIsFullScreen] = useState(false)

  // Handle media queries, automatically collapse sidebar on small screens
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && !sidebarCollapsed) {
        setSidebarCollapsed(true)
      }
    }

    // Initial check
    if (mediaQuery.matches && !sidebarCollapsed) {
      setSidebarCollapsed(true)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [sidebarCollapsed])

  // Toggle sidebar expand/collapse state
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  // Toggle code preview/edit mode
  const toggleCodePreview = () => {
    setCodePreviewActiveState(!codePreviewActiveState)
  }

  // Listen for fullscreen events from child components
  useEffect(() => {
    const handleFullScreenChange = (event: CustomEvent) => {
      setIsFullScreen(event.detail.isFullScreen)
    }

    // Listen for custom events
    window.addEventListener('ide-fullscreen-change' as any, handleFullScreenChange as any)

    return () => {
      window.removeEventListener('ide-fullscreen-change' as any, handleFullScreenChange as any)
    }
  }, [])

  return (
    <div
      className='h-screen flex flex-col text-fg'
      role='application'
      aria-label='IDE Workspace'
    >
      {/* Only show top navigation bar in non-fullscreen mode */}
      {!isFullScreen && (
        <Navbar
          toggleSidebar={toggleSidebar}
          codePreviewActive={codePreviewActiveState}
          toggleCodePreview={toggleCodePreview}
          usageData={usageData}
          isUsageLoading={isUsageLoading}
        />
      )}

      <div className='flex-1 flex overflow-hidden'>
        <main className='flex-1 overflow-hidden -subtle transition-all duration-300'>
          <Index
            codePreviewActive={codePreviewActiveState}
            initialMessages={(children as any)?.props?.initialMessages || []}
            usageData={usageData}
            isUsageLoading={isUsageLoading}
          />
        </main>
      </div>
    </div>
  )
}
