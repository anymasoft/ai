/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * codeblock-toolbar.tsx
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
import { FaRegCopy, FaCode, FaEye } from 'react-icons/fa'
import { MdDarkMode, MdLightMode } from 'react-icons/md'
import * as m from '@/paraglide/messages'

interface CodeBlockToolbarProps {
  originalLang?: string
  usingAlternativeHighlighting: boolean
  isMarkdownFile: boolean
  isPreviewMode: boolean
  isDarkMode: boolean
  copied: boolean
  isEmbedded: boolean
  onPreviewToggle: () => void
  onThemeToggle: () => void
  onCopy: () => void
}

/**
 * Code block toolbar component
 */
export function CodeBlockToolbar({
  originalLang,
  usingAlternativeHighlighting,
  isMarkdownFile,
  isPreviewMode,
  isDarkMode,
  copied,
  isEmbedded,
  onPreviewToggle,
  onThemeToggle,
  onCopy
}: CodeBlockToolbarProps) {
  return (
    <div
      className={`absolute flex items-stretch bg-white text-sm z-10 border border-gray-500/20  ${
        isEmbedded ? 'top-12 right-4' : '-top-3 right-2'
      } dark:bg-gray-800 overflow-hidden divide-x divide-gray-500/20`}
    >
      {originalLang ? (
        <div className='px-2 flex items-center'>
          {originalLang}
          {usingAlternativeHighlighting && (
            <span
              className='ml-1 text-xs text-amber-500 dark:text-amber-400'
              title={m["ide.fileTree.codeblock.toolbar.useAlternativeSyntax"]()}
            >
              *
            </span>
          )}
        </div>
      ) : null}
      
      {/* Markdown preview toggle button */}
      {isMarkdownFile && (
        <button
          type='button'
          className='px-2 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200'
          onClick={onPreviewToggle}
          aria-label={isPreviewMode ? m["ide.fileTree.codeblock.toolbar.switchToCodeMode"]() : m["ide.fileTree.codeblock.toolbar.switchToPreviewMode"]()}
          title={isPreviewMode ? m["ide.fileTree.codeblock.toolbar.viewSourceCode"]() : m["ide.fileTree.codeblock.toolbar.previewMarkdown"]()}
        >
          {isPreviewMode ? <FaCode /> : <FaEye />}
        </button>
      )}
      
      {/* Theme toggle button */}
      <button
        type='button'
        className='px-2 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200'
        onClick={onThemeToggle}
        aria-label={isDarkMode ? m["ide.fileTree.codeblock.toolbar.switchToLightMode"]() : m["ide.fileTree.codeblock.toolbar.switchToDarkMode"]()}
      >
        {isDarkMode ? <MdLightMode /> : <MdDarkMode />}
      </button>
      
      {/* Copy button */}
      <button
        type='button'
        className='px-2 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200'
        onClick={onCopy}
        aria-label={m["ide.fileTree.codeblock.toolbar.copyToClipboard"]()}
      >
        {copied ? <span className='text-xs'>{m["ide.fileTree.codeblock.toolbar.copied"]()}</span> : <FaRegCopy />}
      </button>
    </div>
  )
}
