/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * useFileContent.tsx
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

import { useMemo } from 'react'

interface FileContentData {
  codeContent: string
  fullPath: string
  isImageFile: boolean
  isMarkdownFile: boolean
}

/**
 * Hook for parsing file content and path
 */
export function useFileContent(
  props: React.HTMLProps<HTMLPreElement> & {
    'data-path'?: string
  }
): FileContentData {
  return useMemo(() => {
    // @ts-ignore
    let lang = props?.children?.props?.className?.replace('language-', '')
    
    // Check file type
    const isImageFile = lang === 'image'
    const isMarkdownFile = lang === 'markdown' || lang === 'md'
    
    // Get file path and code content
    let filePath = ''
    let codeText = ''
    
    // Safely get child element content
    const childrenObj = props.children as any
    if (childrenObj?.props?.children && typeof childrenObj.props.children === 'string') {
      codeText = childrenObj.props.children
    }
    
    // Try to get file path from first line comment
    if (codeText) {
      const lines = codeText.trim().split('\n')
      if (lines && lines.length > 0 && lines[0] && lines[0].startsWith('// Path:')) {
        filePath = lines[0].replace('// Path:', '').trim()
        // Remove this line from code
        codeText = lines.slice(1).join('\n')
      }
    }
    
    const fullPath = props?.['data-path'] || filePath || 'Path not specified'
    
    const children = props.children as
      | undefined
      | {
          props: {
            children: string
          }
        }
    
    const codeContent = children?.props?.children || codeText
    
    return {
      codeContent,
      fullPath,
      isImageFile,
      isMarkdownFile
    }
  }, [props.children, props['data-path']])
}
