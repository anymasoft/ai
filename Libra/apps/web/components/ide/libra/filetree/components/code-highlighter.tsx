/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * code-highlighter.tsx
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
import { transformerNotationDiff } from '@shikijs/transformers'
import { getHighlighter } from '../utils/highlighter'
import { generateCodeBlockStyles, getThemeBackgroundColor, getThemeName } from '../utils/styles'

interface CodeHighlighterProps {
  codeContent: string
  lang: string
  isDarkMode: boolean
  showLineNumbers: boolean
  startLineNumber: number
  isEmbedded: boolean
}

/**
 * Code highlighting component
 */
export function CodeHighlighter({
  codeContent,
  lang,
  isDarkMode,
  showLineNumbers,
  startLineNumber,
  isEmbedded
}: CodeHighlighterProps) {
  const [codeElement, setCodeElement] = React.useState<React.ReactElement>(
    <pre className={'shiki github-light overflow-auto scrollable-container'}>
      <code>{codeContent}</code>
    </pre>
  )
  
  const ref = React.useRef<any>(null)
  
  React[typeof document !== 'undefined' ? 'useLayoutEffect' : 'useEffect'](() => {
    (async () => {
      // Select styles based on current theme
      const theme = getThemeName(isDarkMode)
      const bgColor = getThemeBackgroundColor(isDarkMode)
      
      const { highlighter, langToUse } = await getHighlighter(lang, [theme])
      
      let html = await highlighter.codeToHtml(codeContent, {
        lang: langToUse,
        theme,
        transformers: [transformerNotationDiff()],
      })
      
      // Add styles
      const styles = generateCodeBlockStyles(showLineNumbers, startLineNumber, bgColor)
      html = styles + html
      
      setCodeElement(
        <div
          className={`${
            isEmbedded ? 'h-full [&>pre]:h-full [&>pre]:rounded-none' : ''
          } ${showLineNumbers ? 'with-line-numbers' : ''} overflow-auto scrollable-container`}
          style={
            {
              '--start-line': startLineNumber,
              backgroundColor: bgColor,
            } as React.CSSProperties
          }
          dangerouslySetInnerHTML={{ __html: html }}
          ref={ref}
        />
      )
    })()
  }, [codeContent, lang, showLineNumbers, startLineNumber, isDarkMode, isEmbedded])
  
  return codeElement
}
