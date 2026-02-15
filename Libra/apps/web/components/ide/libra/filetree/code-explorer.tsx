/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * code-explorer.tsx
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

import React, { useRef, useEffect } from 'react'

import { FileExplorer } from '@/components/ide/libra/filetree/file-explorer'
import { CodeBlock } from './code-block'
import { CodeEditor } from './components/code-editor'
import { CodeExplorerTopBar } from './code-explorer-top-bar'
import { useUpgradeModal } from '@/components/common/upgrade-modal'
import * as m from '@/paraglide/messages'

// Import or copy file icon function from render-filetree.tsx
const getFileIconPath = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'ts':
    case 'tsx':
      return '/images/file-icons/typescript.svg'
    case 'js':
    case 'jsx':
      return '/images/file-icons/javascript.svg'
    case 'css':
      return '/images/file-icons/css.svg'
    case 'html':
      return '/images/file-icons/html.svg'
    case 'json':
      return '/images/file-icons/json.svg'
    case 'svelte':
      return '/images/file-icons/svelte.svg'
    case 'vue':
      return '/images/file-icons/vue.svg'
    case 'md':
      return '/images/file-icons/markdown.svg'
    case 'py':
      return '/images/file-icons/python.svg'
    case 'java':
      return '/images/file-icons/java.svg'
    case 'go':
      return '/images/file-icons/go.svg'
    case 'rb':
      return '/images/file-icons/ruby.svg'
    case 'php':
      return '/images/file-icons/php.svg'
    case 'rs':
      return '/images/file-icons/rust.svg'
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return '/images/file-icons/c.svg'
    case 'cs':
      return '/images/file-icons/csharp.svg'
    default:
      return '/images/file-icons/txt.svg'
  }
}

// File icon component
const FileIcon = ({ filename }: { filename: string }) => {
  return (
    <img
      src={getFileIconPath(filename)}
      alt={`${filename} file icon`}
      width={16}
      height={16}
      className='inline-block mr-2'
    />
  )
}

function overrideExtension(ext: string | undefined) {
  if (!ext) return 'txt'

  // Image file types
  const imageTypes = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico']
  if (imageTypes.includes(ext.toLowerCase())) return 'image'

  // Override some extensions
  if (['cts', 'mts'].includes(ext)) return 'ts'
  if (['cjs', 'mjs'].includes(ext)) return 'js'
  if (['prettierrc', 'babelrc', 'webmanifest'].includes(ext)) return 'json'
  if (['env', 'example'].includes(ext)) return 'sh'
  if (
    [
      'gitignore',
      'prettierignore',
      'log',
      'gitattributes',
      'editorconfig',
      'lock',
      'opts',
      'Dockerfile',
      'dockerignore',
      'npmrc',
      'nvmrc',
    ].includes(ext)
  )
    return 'txt'

  return ext
}

interface CodeExplorerProps {
  activeTab: 'code'
  currentCode: string
  currentPath: string
  githubContents: any[]
  // library: Library
  prefetchFileContent: (path: string) => void
  setActiveTab: (tab: 'code') => void
  setCurrentPath: (path: string) => void
  // Add function to get file content
  getFileContent?: (path: string) => Promise<string>
  // Add functions for editing functionality
  updateFileContent?: (path: string, content: string) => boolean
  deployChanges?: () => Promise<void>
  onHistoryUpdate?: (message: any) => void
}

export function CodeExplorer({
  activeTab,
  currentCode,
  currentPath,
  githubContents,
  prefetchFileContent,
  setActiveTab,
  setCurrentPath,
  getFileContent,
  updateFileContent,
  deployChanges,
  onHistoryUpdate,
}: CodeExplorerProps) {
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  // If close sidebar, only keep code
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  // Add edit mode state management
  const [isEditMode, setIsEditMode] = React.useState(false)
  // Add scroll state
  const [isScrolling, setIsScrolling] = React.useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const codeContentRef = useRef<HTMLDivElement>(null)

  // Add upgrade modal functionality
  const { checkFeatureAccess } = useUpgradeModal()

  // Add ref for expanding file tree
  const expandFileTreeRef = React.useRef<((path: string) => void) | null>(null)

  // Track effective current path for expanding file tree
  const [effectiveCurrentPath, setEffectiveCurrentPath] = React.useState<string | null>(null)

  // Update effectiveCurrentPath when currentPath changes
  React.useEffect(() => {
    if (currentPath) {
      setEffectiveCurrentPath(currentPath)
      // Reset edit mode when switching files
      setIsEditMode(false)
    }
  }, [currentPath])

  // When effectiveCurrentPath changes and expand method is available, auto-expand to current path
  React.useEffect(() => {
    if (effectiveCurrentPath && expandFileTreeRef.current && isSidebarOpen) {
      setTimeout(() => {
        if (expandFileTreeRef.current) {
          expandFileTreeRef.current(effectiveCurrentPath)
        }
      }, 100)
    }
  }, [effectiveCurrentPath, isSidebarOpen])

  // Add event listener for keyboard shortcuts
  React.useEffect(() => {
    // Handle ESC key press, exit fullscreen
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleEsc)

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isFullScreen])

  // Handle edit mode toggle
  const handleEditModeToggle = React.useCallback((enabled: boolean) => {
    // Only allow edit mode when edit functions are available
    if (enabled && (!updateFileContent || !deployChanges)) {
      return
    }

    // If enabling edit mode, check membership status
    if (enabled) {
      const hasAccess = checkFeatureAccess('edit-mode', () => {
        setIsEditMode(true)
      })
      
      // If user doesn't have access, the upgrade modal will be shown
      // and setIsEditMode(true) will be called in the success callback
      if (!hasAccess) {
        return
      }
    } else {
      // Disabling edit mode doesn't require membership check
      setIsEditMode(false)
    }
  }, [updateFileContent, deployChanges, checkFeatureAccess])

  // Initialize scroll listener
  useEffect(() => {
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

    const container = codeContentRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Extension class name, handle full screen mode
  const containerClassNames = `h-full flex flex-col ${
    isFullScreen
      ? 'fixed inset-0 z-[9999] bg-background dark:bg-background'
      : ''
  }`

  // File extension
  const extension = currentPath ? currentPath.split('.').pop() : ''
  const fixedExtension = extension ? overrideExtension(extension) : 'txt'

  // Extract file name for display at top
  const fileName = currentPath ? currentPath.split('/').pop() : ''

  return (
    <div className={containerClassNames}>
      <CodeExplorerTopBar
        activeTab={activeTab}
        isFullScreen={isFullScreen}
        isSidebarOpen={isSidebarOpen}
        isEditMode={isEditMode}
        hasEditingCapability={!!(updateFileContent && deployChanges)}
        setActiveTab={setActiveTab}
        setIsFullScreen={setIsFullScreen}
        setIsSidebarOpen={setIsSidebarOpen}
        setIsEditMode={handleEditModeToggle}
      />
      <div className='flex-1 flex overflow-hidden'>
        {/* File browser sidebar - only show when in code view and sidebar is open */}
        {isSidebarOpen && (
          <FileExplorer
            githubContents={githubContents}
            currentPath={currentPath}
            isSidebarOpen={true}
            prefetchFileContent={prefetchFileContent}
            setCurrentPath={setCurrentPath}
            expandToPath={expandFileTreeRef}
          />
        )}

        {/* Main content area */}
        <div
          className={
            `flex-1 h-full flex flex-col overflow-auto scrollable-container ${isScrolling ? 'scrolling' : ''}`
          }
          ref={codeContentRef}
        >
          {currentPath ? (
            <>
              {/* Code area - take up entire space */}
              <div className={'flex-1'}>
                {isEditMode && updateFileContent && deployChanges ? (
                  <CodeEditor
                    codeContent={currentCode}
                    filePath={currentPath}
                    language={fixedExtension}
                    showLineNumbers={true}
                    isEmbedded={true}
                    isEditMode={isEditMode}
                    onEditModeChange={handleEditModeToggle}
                    updateFileContent={updateFileContent}
                    deployChanges={deployChanges}
                    className='h-full'
                    onHistoryUpdate={onHistoryUpdate || (() => {})}
                  />
                ) : (
                  <CodeBlock
                    isEmbedded
                    showLineNumbers={true}
                    data-path={currentPath}
                    className='h-full'
                    isEditMode={isEditMode}
                    hasEditingCapability={!!(updateFileContent && deployChanges)}
                    onEditModeChange={handleEditModeToggle}
                  >
                    <code className={`language-${fixedExtension}`}>{currentCode}</code>
                  </CodeBlock>
                )}
              </div>
            </>
          ) : (
            <div className='flex items-center justify-center h-full p-4'>
              <div className=' dark: border border-default rounded-lg p-8 shadow-sm max-w-md w-full'>
                <div className='flex flex-col items-center gap-3 text-fg-muted'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='w-12 h-12'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    aria-label='File icon'
                  >
                    <title>File icon</title>
                    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                    <polyline points='14 2 14 8 20 8' />
                    <line x1='9' y1='15' x2='15' y2='15' />
                  </svg>
                  <p className='text-lg font-medium text-fg-default'>{m["ide.fileTree.codeExplorer.selectFilePrompt"]()}</p>
                  <p className='text-sm text-center'>{m["ide.fileTree.codeExplorer.selectFileDescription"]()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
