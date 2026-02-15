/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-explorer.tsx
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

import type { GitHubFileNode } from '@/lib/file'
import React, { useRef, useEffect } from 'react'
import { RenderFileTree } from './render-filetree'
import * as m from '@/paraglide/messages'

interface FileExplorerProps {
  currentPath: string | null
  githubContents: GitHubFileNode[] | undefined
  isSidebarOpen: boolean
  prefetchFileContent: (file: string) => void
  setCurrentPath: (file: string) => void
  expandToPath?: React.MutableRefObject<((path: string) => void) | null>
}

export function FileExplorer({
  currentPath,
  githubContents,
  isSidebarOpen,
  prefetchFileContent,
  setCurrentPath,
  expandToPath,
}: FileExplorerProps) {
  const [sidebarWidth, setSidebarWidth] = React.useState(220)
  const [isResizing, setIsResizing] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileTreeContainerRef = useRef<HTMLDivElement>(null)
  const MIN_SIDEBAR_WIDTH = 60

  // Initialize responsive state and scroll listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    const handleScroll = () => {
      // Set scrolling state
      setIsScrolling(true)

      // Clear previous timer
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Set new timer, hide scroll bar after 2 seconds of scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 2000)
    }

    // Initial check
    handleResize()
    window.addEventListener('resize', handleResize)

    const container = fileTreeContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Initialize expandedFolders with root-level folders
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(() => {
    const expanded = new Set<string>()
    if (githubContents && currentPath) {
      // Use the same path construction logic to initialize expanded state
      const dirs = flattedOnlyToDirs(githubContents)
      const pathParts = currentPath.split('/')

      // Build intermediate path string
      let currentDir = ''
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (part) {
          if (currentDir === '') {
            currentDir = part
          } else {
            currentDir = `${currentDir}/${part}`
          }

          if (dirs.some((d) => d.path === currentDir)) {
            expanded.add(currentDir)
          }
        }
      }
    }
    return expanded
  })

  const startResizeRef = React.useRef({
    startX: 0,
    startWidth: 0,
  })

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    setIsResizing(true)
    startResizeRef.current = {
      // @ts-ignore
      startX: 'touches' in e ? e?.touches[0]?.clientX : e.clientX,
      startWidth: sidebarWidth,
    }
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return
      // @ts-ignore
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const diff = clientX - startResizeRef.current.startX
      const newWidth = startResizeRef.current.startWidth + diff

      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= 600) {
        setSidebarWidth(newWidth)
      } else if (newWidth < MIN_SIDEBAR_WIDTH) {
        setSidebarWidth(MIN_SIDEBAR_WIDTH)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      if (sidebarWidth <= MIN_SIDEBAR_WIDTH) {
        setSidebarWidth(200)
        const event = new CustomEvent('closeSidebar')
        window.dispatchEvent(event)
      }
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleMouseMove)
      document.addEventListener('touchend', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleMouseMove)
      document.removeEventListener('touchend', handleMouseUp)
    }
  }, [isResizing, sidebarWidth])

  // Expose expand method to parent component
  const expandPathToFile = React.useCallback(
    (path: string) => {
      if (!path || !githubContents) return

      // Get directory list
      const dirs = flattedOnlyToDirs(githubContents)

      // Extract each level of directory from path
      const pathParts = path.split('/')
      const pathDirs: string[] = []

      // Build intermediate path string, handle multi-level directories correctly
      let currentPath = ''
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (part) {
          if (currentPath === '') {
            currentPath = part
          } else {
            currentPath = `${currentPath}/${part}`
          }
          pathDirs.push(currentPath)
        }
      }

      // Expand all matching directories
      setExpandedFolders((prev) => {
        const next = new Set(prev)

        // Add each level of directory to expanded set
        for (const dir of pathDirs) {
          if (dirs.some((d) => d.path === dir)) {
            next.add(dir)
          }
        }

        return next
      })
    },
    [githubContents]
  )

  // Expose expand method to parent component
  React.useEffect(() => {
    if (expandToPath && typeof expandPathToFile === 'function') {
      expandToPath.current = expandPathToFile

      // If current path exists, expand immediately
      if (currentPath) {
        expandPathToFile(currentPath)
      }
    }
  }, [expandPathToFile, expandToPath, currentPath])

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (!githubContents) return null

  // Mobile: use fixed overlay, Desktop: use resizable sidebar
  const mobileClass = isMobile ? 'fixed inset-y-0 left-0 z-40 bg-background shadow-lg' : ''
  const desktopWidthStyle = isMobile ? {} : { width: isSidebarOpen ? sidebarWidth : 0 }

  return (
    <>
      <div
        style={desktopWidthStyle}
        className={`flex-shrink-0 overflow-y-auto scrollable-container ${isScrolling ? 'scrolling' : ''} border-r border-default ${
          isResizing ? '' : 'transition-all duration-300'
        } ${mobileClass} ${isMobile && !isSidebarOpen ? 'translate-x-[-100%]' : ''}`}
        ref={fileTreeContainerRef}
      >
        {githubContents && isSidebarOpen ? (
          <div className={`p-2 md:p-3 file-tree ${isMobile ? 'w-80' : ''}`}>
            <RenderFileTree
              currentPath={currentPath}
              expandedFolders={expandedFolders}
              files={githubContents}
              prefetchFileContent={prefetchFileContent}
              setCurrentPath={setCurrentPath}
              toggleFolder={toggleFolder}
            />
          </div>
        ) : null}
      </div>
      
      {/* Mobile overlay backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30" 
          onClick={() => {
            const event = new CustomEvent('closeSidebar')
            window.dispatchEvent(event)
          }}
        />
      )}
      
      {/* Desktop resize handle - hidden on mobile */}
      {!isMobile && (
        <div
          className={`cursor-col-resize w-1 hover:bg-accent hover:dark:bg-accent transition-colors duration-200 ${
            isSidebarOpen ? '' : 'hidden'
          }`}
          onMouseDown={startResize}
          onTouchStart={startResize}
        />
      )}
    </>
  )
}

function recursiveFlattenGithubContents(
  nodes: Array<GitHubFileNode>,
  bannedDirs: Set<string> = new Set()
): Array<GitHubFileNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'dir' && node.children && !bannedDirs.has(node.name)) {
      return recursiveFlattenGithubContents(node.children, bannedDirs)
    }
    return node
  })
}

function flattedOnlyToDirs(nodes: Array<GitHubFileNode>): Array<GitHubFileNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'dir' && node.children) {
      return [node, ...flattedOnlyToDirs(node.children)]
    }
    return node.type === 'dir' ? [node] : []
  })
}
