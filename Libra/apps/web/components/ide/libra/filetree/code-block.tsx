/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * code-block.tsx
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

import React, { useId } from 'react'
import { FaCode, FaEdit } from 'react-icons/fa'
import { Switch } from '@libra/ui/components/switch'
import { ImageRender } from './components/image-render'
import { MarkdownPreview } from './components/markdown-preview'
import { CodeHighlighter } from './components/code-highlighter'
import { CodeBlockToolbar } from './components/codeblock-toolbar'
import { useFileContent } from './hooks/useFileContent'
import { useCodeBlockTheme } from './hooks/useCodeBlockTheme'
import * as m from '@/paraglide/messages'

export function CodeBlock({
  isEmbedded,
  showLineNumbers = true,
  startLineNumber = 1,
  isEditMode,
  hasEditingCapability,
  onEditModeChange,
  ...props
}: React.HTMLProps<HTMLPreElement> & {
  isEmbedded?: boolean
  showLineNumbers?: boolean
  startLineNumber?: number
  'data-path'?: string
  isEditMode?: boolean
  hasEditingCapability?: boolean
  onEditModeChange?: (enabled: boolean) => void
}) {
  // Generate unique ID for accessibility
  const editModeId = useId()
  
  // Use custom hooks
  const { codeContent, fullPath, isImageFile, isMarkdownFile } = useFileContent(props)
  const { isDarkMode, setIsDarkMode } = useCodeBlockTheme()

  // Handle language type
  // @ts-ignore
  let lang = props?.children?.props?.className?.replace('language-', '')
  const originalLang = lang

  if (lang === 'diff') {
    lang = 'plaintext'
  }

  const usingAlternativeHighlighting = lang === 'toml'

  // State management
  const [copied, setCopied] = React.useState(false)
  const [isPreviewMode, setIsPreviewMode] = React.useState(false)
  const ref = React.useRef<any>(null)

  // Function to render content
  const renderContent = () => {
    if (isImageFile) {
      return <ImageRender codeContent={codeContent} fullPath={fullPath} />
    }

    if (isMarkdownFile && isPreviewMode) {
      return <MarkdownPreview codeContent={codeContent} isDarkMode={isDarkMode} />
    }

    return (
      <CodeHighlighter
        codeContent={codeContent}
        lang={lang}
        isDarkMode={isDarkMode}
        showLineNumbers={showLineNumbers}
        startLineNumber={startLineNumber}
        isEmbedded={isEmbedded || false}
      />
    )
  }

  // Handle copy functionality
  const handleCopy = () => {
    let copyContent =
      typeof ref.current?.innerText === 'string' ? ref.current.innerText : ''

    if (copyContent.endsWith('\n')) {
      copyContent = copyContent.slice(0, -1)
    }

    navigator.clipboard.writeText(copyContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`${props.className} w-full max-w-full relative not-prose flex flex-col`} style={props.style}>
      {/* File path display area */}
      {isEmbedded && (
        <div className='flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-sm flex-shrink-0'>
          <div className='flex items-center'>
            <FaCode className='mr-2 text-gray-500' />
            <span className='font-mono text-gray-700 dark:text-gray-300 truncate'>
              {fullPath}
            </span>
          </div>

          {/* Edit mode toggle - only show when editing capability exists */}
          {hasEditingCapability && (
            <div className='flex items-center gap-2'>
              <FaEdit className='text-gray-500 text-xs' />
              <label htmlFor={editModeId} className='text-xs text-gray-600 dark:text-gray-400'>
                {m['ide.codeEditor.editMode']()}
              </label>
              <Switch
                id={editModeId}
                checked={isEditMode || false}
                onCheckedChange={onEditModeChange}
                aria-label={m['ide.codeEditor.toggleEditMode']()}
              />
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <CodeBlockToolbar
        originalLang={originalLang}
        usingAlternativeHighlighting={usingAlternativeHighlighting}
        isMarkdownFile={isMarkdownFile}
        isPreviewMode={isPreviewMode}
        isDarkMode={isDarkMode}
        copied={copied}
        isEmbedded={isEmbedded || false}
        onPreviewToggle={() => setIsPreviewMode(!isPreviewMode)}
        onThemeToggle={() => setIsDarkMode(!isDarkMode)}
        onCopy={handleCopy}
      />

      {/* Content area */}
      <div ref={ref} className='flex-1 overflow-auto'>
        {renderContent()}
      </div>
    </div>
  )
}
