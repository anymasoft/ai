/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-diff-view.tsx
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

import { type DiffFile, generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView } from '@git-diff-view/react'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import { diffFiles } from '@/lib/diff'
import * as m from '@/paraglide/messages'
import './file-diff-styles.css'

// Default example content
const defaultOldContent = `
export type DiffHighlighter = {
    name: string;
    maxLineToIgnoreSyntax: number;
    setMaxLineToIgnoreSyntax: (v: number) => void;
    ignoreSyntaxHighlightList: (string | RegExp)[];
    setIgnoreSyntaxHighlightList: (v: (string | RegExp)[]) => void;
    getAST: (raw: string, fileName?: string, lang?: string) => DiffAST;
    processAST: (ast: DiffAST) => { syntaxFileObject: Record<number, SyntaxLine>; syntaxFileLineNumber: number };
    hasRegisteredCurrentLang: (lang: string) => boolean;
    // cspell:disable-next-line
    getHighlighterEngine: () => typeof lowlight;
  };`

const defaultNewContent = `export type DiffHighlighter = {
    name: string;
    maxLineToIgnoreSyntax: number;
    setMaxLineToIgnoreSyntax: (v: number) => void;
    ignoreSyntaxHighlightList: (string | RegExp)[];
    setIgnoreSyntaxHighlightList: (v: (string | RegExp)[]) => void;
    getAST: (raw: string, fileName?: string, lang?: string) => DiffAST;
    processAST: (ast: DiffAST) => { syntaxFileObject: Record<number, SyntaxLine>; syntaxFileLineNumber: number };
    hasRegisteredCurrentLang: (lang: string) => boolean;
    getHighlighterEngine: () => DePromise<ReturnType<typeof getHighlighter>> | null;
  };`

interface FileDiffViewProps {
  className?: string
  /** Old content to display in diff mode */
  oldContent?: string
  /** New content to display in diff mode */
  newContent?: string
  /** File path (used to infer file type) */
  filePath?: string
  /** Custom diff view mode, default is split view */
  diffMode?: DiffModeEnum
  /** Loading state */
  isLoading?: boolean
  /** Callback when diff is ready */
  onDiffReady?: () => void
  /** Enable virtual scrolling for large files */
  enableVirtualScrolling?: boolean
}

export function FileDiffView({
  className = '',
  oldContent: propOldContent,
  newContent: propNewContent,
  filePath = 'code.txt',
  diffMode = DiffModeEnum.Split,
  isLoading = false,
  onDiffReady,
  enableVirtualScrolling = false,
}: FileDiffViewProps) {
  // Use next-themes to get current theme
  const { theme, resolvedTheme } = useTheme()

  // Internal state for better UX
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [diffStats, setDiffStats] = useState<{ additions: number; deletions: number } | null>(null)

  // Create diff file with enhanced error handling
  const diffFile = useMemo<DiffFile | null>(() => {
    if (isLoading || internalLoading) return null
    if (internalError) return null

    setInternalLoading(true)
    setInternalError(null)
    try {
      // Use provided content or default content
      const finalOldContent =
        typeof propOldContent === 'string'
          ? propOldContent
          : propOldContent === null
            ? ''
            : defaultOldContent

      const finalNewContent =
        typeof propNewContent === 'string' ? propNewContent : defaultNewContent

      // Get file name and extension from file path
      let fileName = 'code.txt'
      let fileExtension = 'txt'

      if (filePath) {
        // Extract file name
        const pathParts = filePath.split('/')
        fileName = pathParts[pathParts.length - 1] || fileName

        // Get extension from file name
        const extParts = fileName.split('.')
        if (extParts.length > 1) {
          fileExtension = extParts[extParts.length - 1]?.toLowerCase() || 'txt'
        }
      }

      // Handle extension, ensure supported language
      const supportedExts: Record<string, string> = {
        js: 'javascript',
        jsx: 'jsx',
        ts: 'typescript',
        tsx: 'tsx',
        css: 'css',
        html: 'html',
        json: 'json',
        md: 'markdown',
        py: 'python',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        go: 'go',
        rust: 'rust',
        php: 'php',
        rb: 'ruby',
        sh: 'shell',
        yml: 'yaml',
        yaml: 'yaml',
      }

      // Ensure codeType is always a string
      const codeType: string = supportedExts[fileExtension] || 'plaintext'

      // Generate diff file instance
      const instance = generateDiffFile(
        fileName,
        finalOldContent,
        fileName,
        finalNewContent,
        codeType,
        codeType
      )

      instance.initRaw()
      // Calculate custom statistics using diffFiles function
      const stats = diffFiles(finalOldContent, finalNewContent)
      setDiffStats(stats)
      return instance
    } catch (e) {
      const error = e as Error
      setInternalError(error.message)
      // Create a basic diff file when an error occurs
      const fallbackInstance = generateDiffFile(
        'error.txt',
        m['ide.fileDiff.unableToLoadDiffView'](),
        'error.txt',
        m['ide.fileDiff.checkConsoleForInfo'](),
        'plaintext',
        'plaintext'
      )
      fallbackInstance.initRaw()
      return fallbackInstance
    } finally {
      setInternalLoading(false)
      if (onDiffReady) {
        onDiffReady()
      }
    }
  }, [
    propOldContent,
    propNewContent,
    filePath,
    isLoading,
    internalLoading,
    internalError,
    onDiffReady,
  ])

  // Enhanced loading state
  if (isLoading || internalLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className='diff-loading'>
          <div className='diff-loading-spinner w-6 h-6 border-2 border-current border-t-transparent rounded-full mr-3' />
          <span>{m['ide.fileDiff.loadingDiffView']()}</span>
        </div>
      </div>
    )
  }

  // Enhanced error state
  if (internalError) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div
          className={`diff-error text-red-500 p-6 text-center rounded-lg max-w-md ${
            theme === 'dark'
              ? 'bg-red-900/20 border border-red-800/30'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className='text-xl mb-2'>⚠️</div>
          <div className='font-semibold mb-2'>{m['ide.fileDiff.unableToLoadDiffView']()}</div>
          <div className='text-sm opacity-80 mb-4'>
            {internalError || m['ide.fileDiff.checkConsoleForInfo']()}
          </div>
          <button
            type='button'
            onClick={() => {
              setInternalError(null)
              window.location.reload()
            }}
            className='px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors'
          >
            {m['ide.fileDiff.reload']()}
          </button>
        </div>
      </div>
    )
  }

  // Ensure diff file is available
  if (!diffFile) {
    console.error('[FileDiffView] Diff file could not be created')
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div
          className={`text-yellow-600 p-6 text-center rounded-lg max-w-md ${
            theme === 'dark'
              ? 'bg-yellow-900/20 border border-yellow-800/30'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <div className='text-xl mb-2'>📄</div>
          <div className='font-semibold mb-2'>{m['ide.fileDiff.noDiffContentAvailable']()}</div>
          <div className='text-sm opacity-80'>{m['ide.fileDiff.filesIdenticalOrProcessing']()}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full diff-container ${className}`}
      data-theme={theme}
      data-theme-transitioning={false}
      style={{
        overflow: 'auto',
        backgroundColor: 'var(--diff-plain-content)',
        borderRadius: '8px',
        border: '1px solid var(--diff-border)',
      }}
    >
      {/* Diff Statistics Bar */}
      {diffStats && (
        <div className='diff-stats-bar flex items-center justify-between px-4 py-2 bg-var(--diff-expand-content) border-b border-var(--diff-border) text-sm'>
          <div className='flex items-center gap-4'>
            <span className='text-var(--diff-plain-lineNumber-color)'>
              {m['ide.fileDiff.fileLabel']()} {filePath}
            </span>
            {diffStats.additions > 0 && (
              <span className='text-green-600 dark:text-green-400'>
                +{diffStats.additions} {m['ide.fileDiff.linesAdded']()}
              </span>
            )}
            {diffStats.deletions > 0 && (
              <span className='text-red-600 dark:text-red-400'>
                -{diffStats.deletions} {m['ide.fileDiff.linesDeleted']()}
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => window.print()}
              className='px-2 py-1 text-xs bg-var(--diff-plain-lineNumber) hover:bg-var(--diff-hover-bg) rounded transition-colors'
              title={m['ide.fileDiff.printDiff']()}
            >
              🖨️
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Diff View */}
      <DiffView
        diffFile={diffFile}
        diffViewWrap={false}
        diffViewAddWidget={true}
        // @ts-ignore - theme prop exists in the library
        diffViewTheme={resolvedTheme || theme}
        diffViewHighlight={true}
        diffViewMode={diffMode}
        className='w-full diff-enhanced'
        style={{
          minWidth: '100%',
          fontFamily:
            'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
          fontSize: '13px',
          lineHeight: '1.45',
          backgroundColor: 'transparent',
        }}
        // Enhanced props for better UX
        diffViewFontSize={13}
        diffViewLineHeight={1.45}
        diffViewVirtualize={enableVirtualScrolling}
      />
    </div>
  )
}
